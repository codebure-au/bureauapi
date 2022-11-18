class ErrorWithStatus extends Error {
  statusCode?: number;
  name: string;

  constructor(message?: string, statusCode?: number) {
    super(message);

    this.statusCode = statusCode;
    this.name = "ErrorWithStatus";
  }
}

export default ErrorWithStatus;
