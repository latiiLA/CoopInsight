export type AccountRequest = {
  id: string;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  department?: string;
  process?: string;
  subProcess?: string;
  accessPurpose?: string;
  status: string;
  createdAt: string;
};

export function getAccountRequestId(request?: AccountRequest | null) {
  if (!request) {
    return "";
  }

  return request.id || (request as { _id?: string })._id || "";
}
