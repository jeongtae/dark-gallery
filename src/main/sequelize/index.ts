import { Sequelize, DataTypes } from "sequelize";
import { isDev } from "../environment";
import { defineModels, KeyValueStoreCtor } from "./models";
export * from "./models";

const sequelizes: { [frameId: number]: Sequelize } = {};

/** `Sequelize` 인스턴스를 생성하고 모델을 정의한다. `sync()` 호출은 하지 않으며, `frameId`를 키로 하여 인스턴스를 보존된다. */
export function createSequelize(frameId: number, sqlitePath: string): Sequelize {
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

  sequelizes[frameId]?.close();
  sequelizes[frameId] = sequelize;

  return sequelize;
}

/** `frameId` 키에 해당하는 `Sequelize` 인스턴스를 얻는다. */
export function getSequelize(frameId: number) {
  return sequelizes[frameId] || null;
}

/** `frameId` 키에 해당하는 `Sequelize` 인스턴스를 `close()`한다. */
export async function disposeSequelize(frameId: number) {
  const sequelize = sequelizes[frameId];
  delete sequelizes[frameId];
  await sequelize?.close();
}

export async function initKeyValueStoreWithTitle(sequelize: Sequelize, title: string) {
  const KeyValueStore = sequelize.models.keyValueStore as KeyValueStoreCtor;

  const [titleRow] = await KeyValueStore.findOrCreate({
    where: { key: "title" },
    defaults: { key: "title", value: title },
  });

  await KeyValueStore.findOrCreate({
    where: { key: "settings" },
    defaults: { key: "settings", value: "{}" },
  });

  return titleRow.value;
}
