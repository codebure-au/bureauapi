import ErrorWithStatus from "./ErrorWithStatus";

class UserError extends ErrorWithStatus {
  constructor(message?: string) {
    super(message, 400);
  }
}

export default UserError;
