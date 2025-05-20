import { httpRouter } from "convex/server";
// Import any httpActions you define here, e.g.:
// import { myHttpAction } from "./myActionsFile";

const http = httpRouter();

// Example:
// http.route({
//   path: "/myCustomEndpoint",
//   method: "GET",
//   handler: myHttpAction, // Assuming myHttpAction is an httpAction
// });

// This export is needed so convex/http.ts can import it.
export default http;
