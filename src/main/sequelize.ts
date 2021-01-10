import path from "path";
import { Sequelize, DataTypes, ModelAttributeColumnOptions } from "sequelize";
import { isDev } from "./environments";
import type * as Models from "../common/sequelize";

export type { Models };
export type { Sequelize };

/** 주어진 경로의 SQLite 파일에 연결되는 Sequelize 객체를 생성하고,
 * 갤러리와 관련된 모델을 정의합니다.
 * @param sqlitePath SQLite 파일의 경로
 * @return `Sequelize` 객체
 */
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
    type: DataTypes.INTEGER,
  };
  const createdAt = DataTypes.DATE;
  const updatedAt = DataTypes.DATE;

  const Item = sequelize.define<Models.Item>(
    "item",
    {
      id,
      createdAt,
      updatedAt,

      title: DataTypes.TEXT,

      directory: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
          let value = this.getDataValue("directory");
          value = value.replace(path.posix.sep, path.sep);
          return value;
        },
        set(value: string) {
          value = value.replace(path.sep, path.posix.sep);
          this.setDataValue("directory", value);
        },
      },
      filename: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      lost: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      hash: { type: DataTypes.CHAR(40), allowNull: false },
      size: { type: DataTypes.INTEGER, allowNull: false },
      mtime: { type: DataTypes.DATE, allowNull: false },
      time: { type: DataTypes.DATE, allowNull: false },
      timeMode: { type: DataTypes.CHAR(4), allowNull: false },

      rating: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0, max: 10 },
      },
      memo: DataTypes.TEXT,

      type: { type: DataTypes.CHAR(4), allowNull: false },
      width: { type: DataTypes.SMALLINT, allowNull: false },
      height: { type: DataTypes.SMALLINT, allowNull: false },
      duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      thumbnailBase64: DataTypes.TEXT,
      thumbnailPath: DataTypes.TEXT,
      previewVideoPath: DataTypes.TEXT,
    },
    { indexes: [{ unique: true, fields: ["directory", "filename"] }] }
  );

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

  const Config = sequelize.define<Models.Config>(
    "config",
    {
      key: { type: DataTypes.TEXT, primaryKey: true, allowNull: false },
      value: { type: DataTypes.TEXT, allowNull: false },
    },
    { timestamps: false }
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
