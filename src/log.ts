const inDocker = process.env["ENVIRONMENT"] === "docker";

const debug = (...args: any[]) => {
  if (inDocker) return;

  console.log("DEBUG:", ...args);
};

const error = (...args: any[]) => {
  console.log("ERROR:", ...args);
};

export default { debug, error };
