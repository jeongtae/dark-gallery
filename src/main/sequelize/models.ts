import {
  Sequelize,
  Model,
  DataTypes,
  Association,
  ModelCtor,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasManyHasAssociationMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  BelongsToManyGetAssociationsMixin,
  BelongsToManyAddAssociationMixin,
  BelongsToManyHasAssociationMixin,
  BelongsToManyCountAssociationsMixin,
  BelongsToManyCreateAssociationMixin,
  BelongsToGetAssociationMixin,
  BelongsToCreateAssociationMixin,
  Optional,
} from "sequelize";

export type ItemAttributes = {
  id: number;
  /** 항목에 대한 제목 */
  title: string;
  type: "VIDEO" | "IMAGE" | "CARTOON";
  /** 항목에 대한 유저 점수 0~5 */
  rating: number;
  /** 항목 파일의 동일성 검사를 위한 MD5 해시 */
  hash: string;
  /** 파일 시스템 상에 항목이 실제로 위치한 절대경로 */
  path: string;
  /** 썸네일 파일의 이름 */
  thumbnailPath: string;
  /** 항목에 대한 메모 */
  memo: string;

  readonly createdAt: Date;
  readonly updatedAt: Date;
};
export type ItemCreationAttributes = Optional<ItemAttributes, "id" | "rating">;
export type Item = Model<ItemAttributes, ItemCreationAttributes> &
  ItemAttributes & {
    getTags: BelongsToManyGetAssociationsMixin<Tag>;
    addTag: BelongsToManyAddAssociationMixin<Tag, number>;
    hasTag: BelongsToManyHasAssociationMixin<Tag, number>;
    countTags: BelongsToManyCountAssociationsMixin;
    createTag: BelongsToManyCreateAssociationMixin<Tag>;

    readonly tags?: Tag[];
  };
export type ItemCtor = ModelCtor<Item> & {
  associations: {
    tags: Association<Item, Tag>;
  };
};

export type TagAttributes = {
  id: number;
  /** 태그의 이름 */
  name: string;
  /** 태그에 대한 메모 */
  memo: string;
  /** 태그의 아이콘 이미지, Base64로 인코딩된다. */
  icon: string;

  readonly createdAt: Date;
  readonly updatedAt: Date;
};
export type TagCreationAttributes = Optional<TagAttributes, "id" | "memo" | "icon">;
export type Tag = Model<TagAttributes, TagCreationAttributes> &
  TagAttributes & {
    getItems: BelongsToManyGetAssociationsMixin<Item>;
    addItem: BelongsToManyAddAssociationMixin<Item, number>;
    hasItem: BelongsToManyHasAssociationMixin<Item, number>;
    countItems: BelongsToManyCountAssociationsMixin;
    createItem: BelongsToManyCreateAssociationMixin<Item>;
  };
export type TagCtor = ModelCtor<Tag> & {
  associations: {
    items: Association<Tag, Item>;
    group: Association<Tag, TagGroup>;
  };
};

export type TagGroupAttributes = {
  id: number;
  /** 그룹의 이름 */
  name: string;
  /** 그룹에 대한 메모 */
  memo: string;
  /** 그룹의 대표 색상 */
  color: string;
  /** 그룹의 아이콘 이미지, Base64로 인코딩된다. */
  icon: string;

  readonly createdAt: Date;
  readonly updatedAt: Date;
};
export type TagGroupCreationAttributes = Optional<
  TagGroupAttributes,
  "id" | "memo" | "color" | "icon"
>;
export type TagGroup = Model<TagGroupAttributes, TagGroupCreationAttributes> &
  TagGroupAttributes &
  TagAttributes & {
    getTags: HasManyGetAssociationsMixin<Tag>;
    addTag: HasManyAddAssociationMixin<Tag, number>;
    hasTag: HasManyHasAssociationMixin<Tag, number>;
    countTags: HasManyCountAssociationsMixin;
    createTag: HasManyCreateAssociationMixin<Tag>;
  };
export type TagGroupCtor = ModelCtor<TagGroup> & {
  associations: {
    tags: Association<TagGroup, Tag>;
  };
};

export type KeyValueStoreAttributes = {
  key: string;
  value: string;
};
export type KeyValueStore = Model<KeyValueStoreAttributes> & KeyValueStoreAttributes;
export type KeyValueStoreCtor = ModelCtor<KeyValueStore>;

export type ItemToTagAttributes = {
  itemId: number;
  tagId: number;

  readonly createdAt: Date;
  readonly updatedAt: Date;
};
export type ItemToTag = Model<ItemToTagAttributes> & ItemToTagAttributes;
export type ItemToTagCtor = ModelCtor<ItemToTag>;

/** `Sequelize` 인스턴스에 모든 모델을 `define()`한다. */
export function defineModels(sequelize: Sequelize) {
  const Item = sequelize.define("item", {
    title: DataTypes.TEXT,
    type: { type: DataTypes.ENUM("VIDEO", "IMAGE", "CARTOON"), allowNull: false },
    rating: {
      type: DataTypes.SMALLINT({ unsigned: true }),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 5 },
    },
    hash: { type: DataTypes.STRING, allowNull: false },
    path: { type: DataTypes.STRING(512), allowNull: false },
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
