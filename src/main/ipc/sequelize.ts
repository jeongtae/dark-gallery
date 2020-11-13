import { Sequelize, DataTypes } from "sequelize";
import { isDev } from "../environment";

export const sequelizes: { [frameId: string]: Sequelize } = {};

export function createSequelize(sqlitePath: string): Sequelize {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    pool: {
      min: 0,
      max: 1,
      idle: 3000,
    },
    logging: isDev ? console.log : false,
    storage: sqlitePath,
  });

  defineModels(sequelize);

  return sequelize;
}

function defineModels(sequelize: Sequelize) {
  const Media = sequelize.define("media", {
    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnailPath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    microThumbnail: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    memo: DataTypes.STRING,
  });
  const Tag = sequelize.define("tag", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
  const TagGroup = sequelize.define("tagGroup", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    alternativeName: DataTypes.STRING,
    color: DataTypes.STRING,
    prefersAlternative: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });
}
