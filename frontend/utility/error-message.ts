import axios from "axios";

export default function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (!error.response || status === 502 || status === 503 || status === 504) {
      return "Unable to connect to the server. Please try again.";
    }

    if (status !== undefined && status >= 500) {
      return "Internal server error. Please try again.";
    }

    if (typeof data === "string" && data.trim()) {
      return data;
    }

    return error.message || "Request failed. Please try again.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
