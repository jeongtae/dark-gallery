import path from "path";
import { Sequelize, DataTypes, ModelAttributeColumnOptions } from "sequelize";
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
  const id: ModelAttributeColumnOptions = {
    primaryKey: true,
    type: DataTypes.INTEGER.UNSIGNED,
  };
  const createdAt = DataTypes.DATE;
  const updatedAt = DataTypes.DATE;

  const Item = sequelize.define<Models.Item>("item", {
    id,
    createdAt,
    updatedAt,

    title: DataTypes.TEXT,

    path: {
      type: DataTypes.STRING(1024),
      allowNull: false,
      get() {
        let value = this.getDataValue("path");
        value = value.replace("/", path.sep);
        return value;
      },
      set(value: string) {
        value = value.replace(path.sep, "/");
        this.setDataValue("path", value);
      },
    },
    lost: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    hash: { type: DataTypes.CHAR(40), allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    mtime: { type: DataTypes.DATE, allowNull: false },
    time: { type: DataTypes.DATE, allowNull: false },

    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 10 },
    },
    memo: DataTypes.TEXT,

    type: DataTypes.ENUM("IMAGE", "VIDEO"),
  });

  const Tag = sequelize.define<Models.Tag>("tag", {
    id,
    createdAt,
    updatedAt,
    name: { type: DataTypes.TEXT, allowNull: false },
    memo: DataTypes.TEXT,
    icon: DataTypes.TEXT,
  });

  const TagGroup = sequelize.define<Models.TagGroup>("tagGroup", {
    id,
    createdAt,
    updatedAt,
    name: { type: DataTypes.TEXT, allowNull: false },
    memo: DataTypes.TEXT,
    color: DataTypes.STRING,
    icon: DataTypes.TEXT,
  });

  const KeyValueStore = sequelize.define<Models.KeyValueStore>(
    "keyValueStore",
    {
      key: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      value: { type: DataTypes.TEXT, allowNull: false },
    },
    { timestamps: false, freezeTableName: true }
  );

  const ItemToTag = sequelize.define<Models.ItemToTag>("itemToTag", {
    createdAt,
    updatedAt,
    itemId: { type: DataTypes.INTEGER, references: "Items" },
    tagId: { type: DataTypes.INTEGER, references: "Tags" },
  });

  TagGroup.hasMany(Tag);
  Tag.belongsTo(TagGroup, { as: "group" });

  Item.belongsToMany(Tag, { through: ItemToTag });
  Tag.belongsToMany(Item, { through: ItemToTag });
}
