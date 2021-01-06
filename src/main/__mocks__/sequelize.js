const sequelize = jest.requireActual("sequelize");

const { Sequelize } = sequelize;
sequelize.Sequelize = function (...args) {
  for (const arg of args) {
    if (typeof arg === "object") {
      arg.storage = ":memory:";
    }
  }
  return new Sequelize(...args);
};
module.exports = sequelize;
