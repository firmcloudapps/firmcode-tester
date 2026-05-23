export type ViewState<T> =
  | { status: "loading" }
  | { status: "empty"; data?: T }
  | { status: "error"; message: string }
  | { status: "populated"; data: T };
