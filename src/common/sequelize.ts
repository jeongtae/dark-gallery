import type {
  Model,
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
  BelongsToSetAssociationMixin,
} from "sequelize/types";

declare type Raw<T> = Partial<T> & { [key: string]: any };

//#region 아이템 모델
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
export type RawItem = Raw<
  ItemAttributes & {
    readonly tags: RawTag[];
  }
>;
export type ItemCreationAttributes = Optional<ItemAttributes, "id" | "rating">;
export type Item = Model<ItemAttributes, ItemCreationAttributes> &
  ItemAttributes & {
    getTags: BelongsToManyGetAssociationsMixin<Tag>;
    hasTag: BelongsToManyHasAssociationMixin<Tag, number>;
    countTags: BelongsToManyCountAssociationsMixin;
    createTag: BelongsToManyCreateAssociationMixin<Tag>;
    addTag: BelongsToManyAddAssociationMixin<Tag, number>;
    readonly tags?: Tag[];
  };
export type ItemCtor = ModelCtor<Item> & {
  associations: {
    tags: Association<Item, Tag>;
  };
};
//#endregion

//#region 태그 모델
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
export type RawTag = Raw<
  TagAttributes & {
    readonly items: RawItem[];
    readonly group: RawTagGroup;
  }
>;
export type TagCreationAttributes = Optional<TagAttributes, "id" | "memo" | "icon">;
export type Tag = Model<TagAttributes, TagCreationAttributes> &
  TagAttributes & {
    getItems: BelongsToManyGetAssociationsMixin<Item>;
    hasItem: BelongsToManyHasAssociationMixin<Item, number>;
    countItems: BelongsToManyCountAssociationsMixin;
    createItem: BelongsToManyCreateAssociationMixin<Item>;
    addItem: BelongsToManyAddAssociationMixin<Item, number>;
    getGroup: BelongsToGetAssociationMixin<TagGroup>;
    setGroup: BelongsToSetAssociationMixin<TagGroup, number>;
    createGroup: BelongsToCreateAssociationMixin<TagGroup>;
    readonly items?: Item[];
    readonly group?: TagGroup;
  };
export type TagCtor = ModelCtor<Tag> & {
  associations: {
    items: Association<Tag, Item>;
    group: Association<Tag, TagGroup>;
  };
};
//#endregion

//#region 태그 그룹 모델
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
export type RawTagGroup = Raw<
  TagGroupAttributes & {
    tags: RawTag[];
  }
>;
export type TagGroupCreationAttributes = Optional<
  TagGroupAttributes,
  "id" | "memo" | "color" | "icon"
>;
export type TagGroup = Model<TagGroupAttributes, TagGroupCreationAttributes> &
  TagGroupAttributes &
  TagAttributes & {
    getTags: HasManyGetAssociationsMixin<Tag>;
    hasTag: HasManyHasAssociationMixin<Tag, number>;
    countTags: HasManyCountAssociationsMixin;
    createTag: HasManyCreateAssociationMixin<Tag>;
    addTag: HasManyAddAssociationMixin<Tag, number>;
  };
export type TagGroupCtor = ModelCtor<TagGroup> & {
  associations: {
    tags: Association<TagGroup, Tag>;
  };
};
//#endregion

//#region 키-밸류 스토어 모델
export type KeyValueStoreAttributes = {
  key: string;
  value: string;
};
export type RawKeyValueStore = Raw<KeyValueStoreAttributes>;
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
//#endregion