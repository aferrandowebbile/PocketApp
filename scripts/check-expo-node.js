"use strict";

const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (Number.isNaN(major)) {
  process.exit(0);
}

if (major >= 22) {
  console.error(
    [
      "Expo SDK 54 is unstable on Node 22 for this project.",
      "Use Node 20 LTS (or 18/21) and retry.",
      "Example: nvm use 20"
    ].join("\n")
  );
  process.exit(1);
}
