import { Sequelize, DataTypes } from "sequelize";
import { isDev } from "./environments";
import type * as Models from "../common/sequelize";
export type { Models };

export type { Sequelize };

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
  const Item = sequelize.define("item", {
    title: DataTypes.TEXT,
    type: { type: DataTypes.ENUM("VIDEO", "IMAGE", "CARTOON"), allowNull: false },
    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 5 },
    },
    hash: { type: DataTypes.STRING, allowNull: false },
    path: { type: DataTypes.STRING(1024), allowNull: false },
    thumbnailPath: DataTypes.STRING,
    memo: DataTypes.TEXT,
  });

  const Tag = sequelize.define("tag", {
    name: { type: DataTypes.TEXT, allowNull: false },
    memo: DataTypes.TEXT,
    icon: DataTypes.TEXT,
  });

  const TagGroup = sequelize.define("tagGroup", {
    name: { type: DataTypes.TEXT, allowNull: false },
    memo: DataTypes.TEXT,
    color: DataTypes.STRING,
    icon: DataTypes.TEXT,
  });

  const KeyValueStore = sequelize.define(
    "keyValueStore",
    {
      key: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      value: { type: DataTypes.TEXT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true }
  );

  const ItemToTag = sequelize.define("itemToTag", {
    itemId: { type: DataTypes.INTEGER, references: "Items" },
    tagId: { type: DataTypes.INTEGER, references: "Tags" },
  });

  TagGroup.hasMany(Tag);
  Tag.belongsTo(TagGroup, { as: "group" });

  Item.belongsToMany(Tag, { through: ItemToTag });
  Tag.belongsToMany(Item, { through: ItemToTag });
}
