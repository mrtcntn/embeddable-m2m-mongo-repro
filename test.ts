import { MongoDriver, ObjectId } from "@mikro-orm/mongodb";
import {
  MikroORM,
  Entity,
  PrimaryKey,
  Property,
  SerializedPrimaryKey,
  Embeddable,
  Collection,
  ManyToMany,
  Embedded,
  BaseEntity,
} from "@mikro-orm/core";

export class AbstractEntity extends BaseEntity<AbstractEntity, "id" | "_id"> {
  @PrimaryKey()
  _id: ObjectId;

  @SerializedPrimaryKey()
  id!: string;
}

@Embeddable()
export class EmbeddedEntity {
  @ManyToMany(() => OtherEntity)
  otherEntities = new Collection<OtherEntity>(this);

  @Property()
  name: string;

  constructor(data: Partial<EmbeddedEntity>) {
    this.otherEntities = data.otherEntities;
    this.name = data.name;
  }
}

@Entity()
export class ParentEntity extends AbstractEntity {
  @Embedded(() => EmbeddedEntity, { object: true })
  embeddedMember: EmbeddedEntity;

  constructor(data: Partial<ParentEntity>) {
    super();
    this.embeddedMember = new EmbeddedEntity(data.embeddedMember);
  }
}

@Entity()
export class OtherEntity extends AbstractEntity {
  @Property()
  name: string;

  constructor(data: Partial<OtherEntity>) {
    super();
    this.name = data.name;
  }
}

let orm: MikroORM<MongoDriver>;

beforeAll(async () => {
  orm = await MikroORM.init<MongoDriver>({
    type: "mongo",
    clientUrl:
      "mongodb://localhost:27017,localhost:27018,localhost:27019?replicaSet=rs",
    dbName: "test",
    implicitTransactions: true, // defaults to false
    entities: [ParentEntity, OtherEntity, EmbeddedEntity],
    allowGlobalContext: true,
  });
  await orm.getSchemaGenerator().createSchema();
});

test("embeddable m:n population", async () => {
  const otherEntity = await orm.em.insert(OtherEntity, { name: "test" });
  const parentEntity = await orm.em.insert(ParentEntity, {
    embeddedMember: { name: "embedded-test", otherEntities: [otherEntity] },
  });

  await orm.schema.ensureIndexes();

  const found1 = await orm.em
    .repo(OtherEntity)
    .findOneOrFail({ id: otherEntity as string });

  console.log(found1);

  const found2 = await orm.em
    .repo(ParentEntity)
    .findOneOrFail(
      { id: parentEntity as string },
      { populate: ["embeddedMember.otherEntities"] }
    );

  console.log(found2.embeddedMember);

  expect(found1).toBeDefined();
  expect(found2.embeddedMember.otherEntities).toBeDefined();
});

afterAll(async () => {
  await orm.close();
});
