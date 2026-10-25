import { db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { dishInput, type DishFormInput } from "@/lib/validation/dish";
import { buildDishSnapshot, describeChanges, snapshotHash, type DishSnapshot } from "./dish-snapshot";
import { notifyAdmins, notifyUsers } from "./notifications";

export { DomainError };

export type SaveDishResult = {
  id: string;
  revision: { version: number; requiresRetraining: boolean } | null;
};

async function applyIngredients(tx: Tx, dishId: string, rows: ReturnType<typeof dishInput.parse>["ingredients"]) {
  const seen = new Set<string>();
  await tx.dishIngredient.deleteMany({ where: { dishId } });
  let order = 0;
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) throw new DomainError(`"${row.name}" is listed twice. Combine the entries.`);
    seen.add(key);
    // Case-insensitive match against the shared ingredient library; create when new.
    const existing = await tx.ingredient.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    const ingredient = existing ?? (await tx.ingredient.create({ data: { name: row.name } }));
    await tx.dishIngredient.create({
      data: {
        dishId,
        ingredientId: ingredient.id,
        quantity: row.quantity,
        isOptional: row.isOptional,
        isRemovable: row.isRemovable,
        substitutionNotes: row.substitutionNotes,
        sortOrder: order++,
      },
    });
  }
}

async function applyAllergens(tx: Tx, dishId: string, rows: { allergenId: string; presence: "CONTAINS" | "MAY_CONTAIN" }[]) {
  const unique = new Map(rows.map((r) => [r.allergenId, r.presence]));
  if (unique.size) {
    const found = await tx.allergen.count({ where: { id: { in: [...unique.keys()] } } });
    if (found !== unique.size) throw new DomainError("One of the selected allergens no longer exists.");
  }
  await tx.dishAllergen.deleteMany({ where: { dishId } });
  if (unique.size) {
    await tx.dishAllergen.createMany({
      data: [...unique].map(([allergenId, presence]) => ({ dishId, allergenId, presence })),
    });
  }
}

function scalarData(i: ReturnType<typeof dishInput.parse>) {
  return {
    name: i.name,
    categoryId: i.categoryId,
    shortDescription: i.shortDescription,
    description: i.description,
    price: i.price,
    isAvailable: i.isAvailable,
    imageUrl: i.imageUrl,
    dietaryTags: i.dietaryTags,
    crossContactWarnings: i.crossContactWarnings,
    allergenNotes: i.allergenNotes,
    cookingMethod: i.cookingMethod,
    preparationInstructions: i.preparationInstructions,
    prepTimeMinutes: i.prepTimeMinutes,
    servingTemperature: i.servingTemperature,
    garnishes: i.garnishes,
    presentationDetails: i.presentationDetails,
    waiterDescription: i.waiterDescription,
    recommendedPairings: i.recommendedPairings,
    guestInformation: i.guestInformation,
    managerNotes: i.managerNotes,
  };
}

async function requireCategory(tx: Tx, categoryId: string) {
  if (!(await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
    throw new DomainError("The selected category no longer exists.");
  }
}

export async function createDish(adminId: string, raw: DishFormInput): Promise<{ id: string }> {
  const input = dishInput.parse(raw);
  return db.$transaction(async (tx) => {
    await requireCategory(tx, input.categoryId);
    const dish = await tx.dish.create({
      data: {
        ...scalarData(input),
        status: "DRAFT",
        allergensVerifiedAt: input.allergensVerified ? new Date() : null,
        allergensVerifiedById: input.allergensVerified ? adminId : null,
      },
    });
    await applyIngredients(tx, dish.id, input.ingredients);
    await applyAllergens(tx, dish.id, input.allergens);
    return { id: dish.id };
  });
}

/** Which employees must re-study: everyone who acknowledged an earlier revision of this dish. */
async function notifyRevision(tx: Tx, dishId: string, name: string, version: number, requiresRetraining: boolean) {
  const link = `/employee/menu/${dishId}`;
  const employees = await tx.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, select: { id: true } });
  const studied = new Set(
    (await tx.dishStudyProgress.findMany({ where: { dishId }, select: { userId: true }, distinct: ["userId"] })).map((s) => s.userId),
  );
  const retrain = requiresRetraining ? employees.filter((e) => studied.has(e.id)).map((e) => e.id) : [];
  const retrainSet = new Set(retrain);
  await notifyUsers(
    retrain,
    { type: "RETRAINING_REQUIRED", title: `${name} was updated`, message: "This dish has been updated. Please review the new information.", link },
    tx,
  );
  await notifyUsers(
    employees.filter((e) => !retrainSet.has(e.id)).map((e) => e.id),
    { type: "DISH_UPDATED", title: `${name} was updated`, message: `Dish information changed (version ${version}).`, link },
    tx,
  );
  if (retrain.length) {
    await notifyAdmins(
      { type: "RETRAINING_PENDING", title: `Retraining required: ${name}`, message: `${retrain.length} employee${retrain.length === 1 ? "" : "s"} must review the updated dish.`, link: `/admin/menu/${dishId}` },
      tx,
    );
  }
}

/** Creates a new DishRevision iff the content differs from the latest one. */
async function recordRevision(
  tx: Tx,
  dishId: string,
  adminId: string,
  opts: { summary: string | null; requiresRetraining: boolean },
): Promise<{ version: number; requiresRetraining: boolean; first: boolean } | null> {
  const latest = await tx.dishRevision.findFirst({ where: { dishId }, orderBy: { version: "desc" } });
  const snapshot = await buildDishSnapshot(tx, dishId);
  if (latest && snapshotHash(latest.snapshot) === snapshotHash(snapshot)) return null;

  const changes = latest ? describeChanges(latest.snapshot as DishSnapshot, snapshot) : [];
  const version = (latest?.version ?? 0) + 1;
  const requiresRetraining = latest ? opts.requiresRetraining : false;
  await tx.dishRevision.create({
    data: {
      dishId,
      version,
      snapshot,
      requiresRetraining,
      createdById: adminId,
      changeSummary: opts.summary ?? (latest ? `Updated ${changes.join(", ") || "details"}` : "Initial version"),
    },
  });
  await tx.dish.update({ where: { id: dishId }, data: { currentVersion: version } });
  return { version, requiresRetraining, first: !latest };
}

export async function updateDish(adminId: string, dishId: string, raw: DishFormInput): Promise<SaveDishResult> {
  const input = dishInput.parse(raw);
  return db.$transaction(async (tx) => {
    const dish = await tx.dish.findUnique({ where: { id: dishId } });
    if (!dish) throw new DomainError("Dish not found.");
    if (dish.status === "ARCHIVED") throw new DomainError("Restore this dish before editing it.");
    await requireCategory(tx, input.categoryId);

    const allergenSnapshotBefore = await buildDishSnapshot(tx, dishId);
    await tx.dish.update({ where: { id: dishId }, data: scalarData(input) });
    await applyIngredients(tx, dishId, input.ingredients);
    await applyAllergens(tx, dishId, input.allergens);
    const after = await buildDishSnapshot(tx, dishId);

    // Verification: a manager must re-confirm whenever any safety-relevant content changed.
    const safetyChanged = describeChanges(allergenSnapshotBefore, after).some((c) =>
      ["ingredients", "allergens", "dietary information", "cross-contact warnings", "allergen notes"].includes(c),
    );
    if (input.allergensVerified && (safetyChanged || !dish.allergensVerifiedAt)) {
      await tx.dish.update({ where: { id: dishId }, data: { allergensVerifiedAt: new Date(), allergensVerifiedById: adminId } });
    } else if (!input.allergensVerified && safetyChanged) {
      await tx.dish.update({ where: { id: dishId }, data: { allergensVerifiedAt: null, allergensVerifiedById: null } });
    }

    if (dish.status !== "PUBLISHED") return { id: dishId, revision: null };

    const verified = input.allergensVerified || (!safetyChanged && !!dish.allergensVerifiedAt);
    if (!verified) {
      throw new DomainError("Allergen and dietary information changed. Confirm that you have verified it before saving a published dish.");
    }
    const rev = await recordRevision(tx, dishId, adminId, {
      summary: input.changeSummary,
      requiresRetraining: input.requiresRetraining,
    });
    if (rev) await notifyRevision(tx, dishId, input.name, rev.version, rev.requiresRetraining);
    return { id: dishId, revision: rev && { version: rev.version, requiresRetraining: rev.requiresRetraining } };
  });
}

export async function publishDish(adminId: string, dishId: string): Promise<SaveDishResult> {
  return db.$transaction(async (tx) => {
    const dish = await tx.dish.findUnique({ where: { id: dishId } });
    if (!dish) throw new DomainError("Dish not found.");
    if (dish.status === "PUBLISHED") throw new DomainError("This dish is already published.");
    if (dish.status === "ARCHIVED") throw new DomainError("Restore this dish before publishing it.");
    if (!dish.allergensVerifiedAt) {
      throw new DomainError("Verify the allergen and dietary information before publishing. Employees rely on it.");
    }
    const firstPublish = !dish.publishedAt;
    await tx.dish.update({
      where: { id: dishId },
      data: { status: "PUBLISHED", publishedAt: dish.publishedAt ?? new Date() },
    });
    const rev = await recordRevision(tx, dishId, adminId, { summary: null, requiresRetraining: false });
    if (firstPublish) {
      const employees = await tx.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, select: { id: true } });
      await notifyUsers(
        employees.map((e) => e.id),
        { type: "DISH_PUBLISHED", title: `New dish: ${dish.name}`, message: "A new dish is ready to study.", link: `/employee/menu/${dishId}` },
        tx,
      );
    } else if (rev) {
      await notifyRevision(tx, dishId, dish.name, rev.version, false);
    }
    return { id: dishId, revision: rev && { version: rev.version, requiresRetraining: rev.requiresRetraining } };
  });
}

export async function unpublishDish(dishId: string) {
  const res = await db.dish.updateMany({ where: { id: dishId, status: "PUBLISHED" }, data: { status: "DRAFT" } });
  if (res.count !== 1) throw new DomainError("Only published dishes can be unpublished.");
}

export async function archiveDish(dishId: string) {
  const res = await db.dish.updateMany({ where: { id: dishId, status: { in: ["DRAFT", "PUBLISHED"] } }, data: { status: "ARCHIVED" } });
  if (res.count !== 1) throw new DomainError("This dish is already archived.");
}

export async function restoreDish(dishId: string) {
  const res = await db.dish.updateMany({ where: { id: dishId, status: "ARCHIVED" }, data: { status: "DRAFT" } });
  if (res.count !== 1) throw new DomainError("Only archived dishes can be restored.");
}

/** Hard delete — only for dishes with no training history. Everything else must be archived. */
export async function deleteDish(dishId: string) {
  return db.$transaction(async (tx) => {
    const dish = await tx.dish.findUnique({ where: { id: dishId }, select: { id: true } });
    if (!dish) throw new DomainError("Dish not found.");
    const [studies, attempts] = await Promise.all([
      tx.dishStudyProgress.count({ where: { dishId } }),
      tx.quizAttempt.count({ where: { quiz: { dishId } } }),
    ]);
    if (studies + attempts > 0) {
      throw new DomainError("This dish has employee training history. Archive it instead so records are preserved.");
    }
    await tx.dish.delete({ where: { id: dishId } });
  });
}

/** Lets a manager flag (or unflag) the newest revision as requiring retraining after the fact. */
export async function setLatestRevisionRetraining(dishId: string, value: boolean) {
  return db.$transaction(async (tx) => {
    const dish = await tx.dish.findUnique({ where: { id: dishId } });
    if (!dish || dish.status !== "PUBLISHED") throw new DomainError("Only published dishes can require retraining.");
    const latest = await tx.dishRevision.findFirst({ where: { dishId }, orderBy: { version: "desc" } });
    if (!latest || latest.version < 2) throw new DomainError("There is no updated version to retrain on yet.");
    if (latest.requiresRetraining === value) return latest;
    const updated = await tx.dishRevision.update({ where: { id: latest.id }, data: { requiresRetraining: value } });
    if (value) await notifyRevision(tx, dishId, dish.name, latest.version, true);
    return updated;
  });
}
