import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEventV2, Context as LambdaContext } from "aws-lambda";
import { appRouter, createContext } from "@truly/trpc";

const trpcHandler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: ({ event }: { event: APIGatewayProxyEventV2 }) => {
    const headers = event.headers ?? {};
    return createContext({ headers });
  },
});

export const handler = (event: APIGatewayProxyEventV2, context: LambdaContext) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return trpcHandler(event, context);
};