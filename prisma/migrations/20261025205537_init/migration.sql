-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AllergenPresence" AS ENUM ('CONTAINS', 'MAY_CONTAIN');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('INVITE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DISH_PUBLISHED', 'DISH_UPDATED', 'QUIZ_AVAILABLE', 'RETRAINING_REQUIRED', 'QUIZ_FAILED', 'TRAINING_COMPLETED', 'RETRAINING_PENDING');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "jobTitle" TEXT,
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT 'My Restaurant',
    "logoUrl" TEXT,
    "description" TEXT,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "status" "DishStatus" NOT NULL DEFAULT 'DRAFT',
    "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crossContactWarnings" TEXT,
    "allergenNotes" TEXT,
    "allergensVerifiedAt" TIMESTAMP(3),
    "allergensVerifiedById" UUID,
    "cookingMethod" TEXT,
    "preparationInstructions" TEXT,
    "prepTimeMinutes" INTEGER,
    "servingTemperature" TEXT,
    "garnishes" TEXT,
    "presentationDetails" TEXT,
    "waiterDescription" TEXT,
    "recommendedPairings" TEXT,
    "guestInformation" TEXT,
    "managerNotes" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "quantity" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isRemovable" BOOLEAN NOT NULL DEFAULT false,
    "substitutionNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergen" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishAllergen" (
    "dishId" UUID NOT NULL,
    "allergenId" UUID NOT NULL,
    "presence" "AllergenPresence" NOT NULL DEFAULT 'CONTAINS',

    CONSTRAINT "DishAllergen_pkey" PRIMARY KEY ("dishId","allergenId")
);

-- CreateTable
CREATE TABLE "DishRevision" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "requiresRetraining" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DishRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishStudyProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "dishRevisionId" UUID NOT NULL,
    "studiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DishStudyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "passingScore" INTEGER NOT NULL DEFAULT 80,
    "allowRetries" BOOLEAN NOT NULL DEFAULT true,
    "questionCount" INTEGER,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
    "randomizeAnswers" BOOLEAN NOT NULL DEFAULT false,
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT true,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswerOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "answerText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizAnswerOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizRevision" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "quizRevisionId" UUID NOT NULL,
    "dishRevisionId" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "issuedQuestions" JSONB NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER,
    "score" INTEGER,
    "passed" BOOLEAN,
    "passingScore" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttemptAnswer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionRef" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "selectedOptionRef" TEXT,
    "selectedAnswer" TEXT,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "QuizAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSettings_singleton_key" ON "RestaurantSettings"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");

-- CreateIndex
CREATE INDEX "Dish_status_categoryId_idx" ON "Dish"("status", "categoryId");

-- CreateIndex
CREATE INDEX "Dish_updatedAt_idx" ON "Dish"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "DishIngredient_ingredientId_idx" ON "DishIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "DishIngredient_dishId_ingredientId_key" ON "DishIngredient"("dishId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_name_key" ON "Allergen"("name");

-- CreateIndex
CREATE INDEX "DishAllergen_allergenId_idx" ON "DishAllergen"("allergenId");

-- CreateIndex
CREATE UNIQUE INDEX "DishRevision_dishId_version_key" ON "DishRevision"("dishId", "version");

-- CreateIndex
CREATE INDEX "DishStudyProgress_userId_dishId_idx" ON "DishStudyProgress"("userId", "dishId");

-- CreateIndex
CREATE UNIQUE INDEX "DishStudyProgress_userId_dishRevisionId_key" ON "DishStudyProgress"("userId", "dishRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_dishId_key" ON "Quiz"("dishId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_sortOrder_idx" ON "QuizQuestion"("quizId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuizAnswerOption_questionId_idx" ON "QuizAnswerOption"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizRevision_quizId_version_key" ON "QuizRevision"("quizId", "version");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_status_idx" ON "QuizAttempt"("userId", "quizId", "status");

-- CreateIndex
CREATE INDEX "QuizAttempt_submittedAt_idx" ON "QuizAttempt"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttemptAnswer_attemptId_questionRef_key" ON "QuizAttemptAnswer"("attemptId", "questionRef");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishAllergen" ADD CONSTRAINT "DishAllergen_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishAllergen" ADD CONSTRAINT "DishAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishRevision" ADD CONSTRAINT "DishRevision_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishStudyProgress" ADD CONSTRAINT "DishStudyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishStudyProgress" ADD CONSTRAINT "DishStudyProgress_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishStudyProgress" ADD CONSTRAINT "DishStudyProgress_dishRevisionId_fkey" FOREIGN KEY ("dishRevisionId") REFERENCES "DishRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswerOption" ADD CONSTRAINT "QuizAnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizRevision" ADD CONSTRAINT "QuizRevision_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizRevisionId_fkey" FOREIGN KEY ("quizRevisionId") REFERENCES "QuizRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_dishRevisionId_fkey" FOREIGN KEY ("dishRevisionId") REFERENCES "DishRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttemptAnswer" ADD CONSTRAINT "QuizAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────── Constraints Prisma cannot express ─────────

-- RestaurantSettings is a singleton: the unique `singleton` column may only ever be TRUE.
ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_singleton_true" CHECK ("singleton" = TRUE);

ALTER TABLE "Quiz"
  ADD CONSTRAINT "Quiz_passingScore_range" CHECK ("passingScore" BETWEEN 1 AND 100),
  ADD CONSTRAINT "Quiz_questionCount_positive" CHECK ("questionCount" IS NULL OR "questionCount" > 0);

ALTER TABLE "QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_score_range" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "QuizAttempt_submitted_consistency" CHECK (
    ("status" = 'IN_PROGRESS' AND "submittedAt" IS NULL AND "score" IS NULL)
    OR ("status" = 'SUBMITTED' AND "submittedAt" IS NOT NULL AND "score" IS NOT NULL AND "passed" IS NOT NULL)
  );

ALTER TABLE "Dish"
  ADD CONSTRAINT "Dish_price_nonneg" CHECK ("price" IS NULL OR "price" >= 0),
  ADD CONSTRAINT "Dish_prepTime_nonneg" CHECK ("prepTimeMinutes" IS NULL OR "prepTimeMinutes" >= 0);

-- Every dish may have at most one in-progress attempt per user.
CREATE UNIQUE INDEX "QuizAttempt_one_in_progress"
  ON "QuizAttempt" ("userId", "quizId") WHERE "status" = 'IN_PROGRESS';
