import "dotenv/config";
import { Api, Config, NextjsSite, Script, StackContext } from "sst/constructs";
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
      // ─── Stage-aware domain config ─────────────────────────────────
      const stage = app.stage;
      const knownStages = ["staging", "release", "prod", "hotfix"];
      const isPersonalDev = !knownStages.includes(stage);

      // Each AWS account has its own Route 53 hosted zone.
      const hostedZone = isPersonalDev
        ? "dev.mytruly.app"
        : stage === "staging"
          ? "staging.mytruly.app"
          : stage === "release"
            ? "release.mytruly.app"
            : stage === "hotfix"
              ? "hotfix.mytruly.app"
              : "mytruly.app"; // prod stage

      const apiDomain = isPersonalDev
        ? `api.${stage}.dev.mytruly.app`
        : stage === "prod"
          ? "api.mytruly.app"
          : `api.${stage}.mytruly.app`;

      const webDomain = isPersonalDev
        ? `go.${stage}.dev.mytruly.app`
        : stage === "prod"
          ? "go.mytruly.app"
          : `go.${stage}.mytruly.app`;

      const landingDomain = isPersonalDev
        ? `${stage}.dev.mytruly.app`
        : stage === "prod"
          ? "mytruly.app"
          : `${stage}.mytruly.app`;

      // ─── Infrastructure ────────────────────────────────────────────
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
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
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
        customDomain: {
          domainName: apiDomain,
          hostedZone: hostedZone,
        },
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
        customDomain: {
          domainName: webDomain,
          hostedZone: hostedZone,
        },
        environment: {
          NEXT_PUBLIC_API_URL: api.customDomainUrl ?? api.url,
        },
      });

      const landing = new NextjsSite(stack, "landing", {
        path: "apps/landing",
        customDomain: {
          domainName: landingDomain,
          hostedZone: hostedZone,
        },
        environment: {
          NEXT_PUBLIC_APP_URL: web.customDomainUrl ?? web.url ?? "http://localhost:3000",
          NEXT_PUBLIC_API_URL: api.customDomainUrl ?? api.url,
        },
      });

      // ─── Database Migrations ─────────────────────────────────────────
      // Runs `prisma migrate deploy` inside the VPC after every SST deploy.
      // The Lambda has direct access to RDS — no bastion needed.
      new Script(stack, "db-migrate", {
        onCreate: "packages/database/src/migrate.handler",
        onUpdate: "packages/database/src/migrate.handler",
        defaults: {
          function: {
            enableLiveDev: false,
            runtime: "nodejs20.x",
            timeout: 300,
            memorySize: 1024,
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [apiSg],
            bind: [dbUrl],
            environment: {
              DB_SECRET_ARN: db.secret?.secretArn ?? "",
            },
            permissions: [
              new iam.PolicyStatement({
                actions: ["ssm:GetParameter", "kms:Decrypt"],
                resources: ["*"],
              }),
              new iam.PolicyStatement({
                actions: ["secretsmanager:GetSecretValue"],
                resources: [db.secret?.secretArn ?? "*"],
              }),
            ],
            copyFiles: [
              {
                from: "packages/database/generated/client",
                to: "generated/client",
              },
              {
                from: "packages/database/prisma",
                to: "prisma",
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

      stack.addOutputs({
        ApiEndpoint: api.customDomainUrl ?? api.url,
        WebUrl: web.customDomainUrl ?? web.url,
        LandingUrl: landing.customDomainUrl ?? landing.url,
        DatabaseEndpoint: db.dbInstanceEndpointAddress,
        DatabaseSecretArn: db.secret?.secretArn ?? "none",
      });
    });
  },
};
