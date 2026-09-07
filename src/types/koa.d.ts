import "koa";

declare module "koa" {
  interface DefaultState {
    user: {
      id: number;
      role: "user" | "admin";
    };
  }
}
