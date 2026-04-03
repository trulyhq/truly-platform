import "dotenv/config";
import { Api, Config, NextjsSite, StackContext } from "sst/constructs";
import type { SSTConfig } from "sst";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";

export default {
  config(_input: SSTConfig["config"] extends (arg: infer A) => any ? A : never) {
    return {
      name: "truly-platform",
      region: process.env["AWS_REGION"] ?? "eu-west-1",
    };
  },
  stacks(app: SSTConfig["stacks"] extends (arg: infer A) => any ? A : never) {
    app.stack(function Stack({ stack }: StackContext) {
      const vpc = new ec2.Vpc(stack, "vpc", {
        maxAzs: 2,
        natGateways: 1,
        subnetConfiguration: [
          { name: "public", subnetType: ec2.SubnetType.PUBLIC },
          { name: "private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        ],
      });

      const db = new rds.DatabaseInstance(stack, "db", {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.of("15.16", "15"),
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
        ),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        allocatedStorage: 20,
        maxAllocatedStorage: 20,
        publiclyAccessible: false,
        multiAz: false,
        credentials: rds.Credentials.fromGeneratedSecret("postgres"),
        databaseName: "truly",
      });

      const dbUrl = new Config.Secret(stack, "DATABASE_URL");

      const apiSg = new ec2.SecurityGroup(stack, "api-sg", { vpc });
      db.connections.allowDefaultPortFrom(apiSg);

      const api = new Api(stack, "api", {
        routes: {
          "POST /trpc/{proxy+}": "apps/backend/src/handler.handler",
          "GET /trpc/{proxy+}": "apps/backend/src/handler.handler",
          "GET /health": "apps/backend/src/health.handler",
        },
        defaults: {
          function: {
            enableLiveDev: false,
            runtime: "nodejs20.x",
            timeout: 30,
            memorySize: 1024,
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [apiSg],
            bind: [dbUrl],
            permissions: [
              new iam.PolicyStatement({
                actions: ["ssm:GetParameter", "kms:Decrypt"],
                resources: ["*"],
              }),
            ],
            copyFiles: [
              {
                from: "packages/database/generated/client",
                to: "generated/client",
              },
            ],
            nodejs: {
              format: "cjs",
              esbuild: {
                target: "node20",
              },
              install: ["@prisma/client", "prisma"],
            },
          },
        },
      });

      const web = new NextjsSite(stack, "web", {
        path: "apps/web",
        environment: {
          NEXT_PUBLIC_API_URL: api.url,
        },
      });

      stack.addOutputs({
        ApiEndpoint: api.url,
        WebUrl: web.url,
        DatabaseEndpoint: db.dbInstanceEndpointAddress,
        DatabaseSecretArn: db.secret?.secretArn ?? "none",
      });
    });
  },
};