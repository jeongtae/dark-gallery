module.exports = {
  globals: {
    "ts-jest": {
      tsconfig: "src/main/tsconfig.json",
    },
  },
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/main/"],
};
