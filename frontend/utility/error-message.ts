import axios from "axios";

export default function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data === "string") {
      return data;
    }

    if (error.request && !error.response) {
      return "Unable to connect to the server. Please try again.";
    }

    return error.message || "Request failed. Please try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}