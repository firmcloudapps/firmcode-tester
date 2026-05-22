import { Controller } from "@nestjs/common";
import helper from "./helper";

export function formatName(name: string): string {
  return name.trim();
}

export class ReviewController {
  async handle(id: string) {
    return helper(id);
  }
}

const buildMessage = (name: string) => {
  return `hello ${formatName(name)}`;
};
