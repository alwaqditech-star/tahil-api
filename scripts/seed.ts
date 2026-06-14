/**
 * إعادة تعبئة البيانات — يحافظ على جدول users كما هو
 * Usage: npm run db:seed
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql, eq } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { getMysqlPoolConfig } from "../src/lib/db-config";

const {
  users,
  projects,
  contractors,
  contractItems,
  suppliers,
  purchases,
  expenses,
  pettyCash,
  extracts,
  extractLineItems,
  expenseCategories,
  projectAssignments,
  projectItems,
  catalogItems,
} = schema;

const TABLES_TO_CLEAR = [
  "extract_line_items",
  "extracts",
  "purchases",
  "contract_items",
  "project_items",
  "expenses",
  "petty_cash",
  "project_assignments",
  "expense_categories",
  "catalog_items",
  "projects",
  "contractors",
  "suppliers",
];

async function main() {
  const pool = mysql.createPool(getMysqlPoolConfig());
  const db = drizzle(pool, { schema, mode: "default" });

  console.log("🗑️  مسح جميع البيانات (ما عدا المستخدمين)...");
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const t of TABLES_TO_CLEAR) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    } catch {
      try {
        await db.execute(sql.raw(`DELETE FROM ${t}`));
      } catch {
        console.log(`   ⚠ تخطي جدول ${t} (غير موجود)`);
      }
    }
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  let freshUsers = await db.select().from(users);
  if (freshUsers.length === 0) {
    console.log("👤 لا يوجد مستخدمون — إنشاء الحسابات الافتراضية...");
    const bcrypt = await import("bcryptjs");
    const adminHash = await bcrypt.hash("admin123", 10);
    const managerHash = await bcrypt.hash("manager123", 10);
    const accountantHash = await bcrypt.hash("accountant123", 10);

    await db.insert(users).values([
      { name: "مدير النظام", email: "admin@jade.sa", username: "admin", passwordHash: adminHash, role: "admin", department: "الإدارة" },
      { name: "أحمد المنصوري", email: "manager@jade.sa", username: "manager2", passwordHash: managerHash, role: "project_manager", department: "المشاريع" },
      { name: "سارة العتيبي", email: "manager2@jade.sa", username: "manager3", passwordHash: managerHash, role: "project_manager", department: "المشاريع" },
      { name: "خالد المحاسب", email: "accountant@jade.sa", username: "accountant4", passwordHash: accountantHash, role: "accountant", department: "المالية" },
      { name: "نورة المحاسبة", email: "accountant2@jade.sa", username: "accountant5", passwordHash: accountantHash, role: "accountant", department: "المالية" },
      { name: "فهد المشرف", email: "supervisor@jade.sa", username: "supervisor1", passwordHash: managerHash, role: "site_supervisor", department: "الموقع" },
    ]);
    freshUsers = await db.select().from(users);
  } else {
    console.log(`👤 تم الاحتفاظ بـ ${freshUsers.length} مستخدم موجود`);
  }

  if (freshUsers.length === 0) {
    console.error("❌ فشل إعداد المستخدمين");
    process.exit(1);
  }

  const byUsername = Object.fromEntries(freshUsers.filter((u) => u.username).map((u) => [u.username!, u]));
  const admin = byUsername["admin"] ?? freshUsers.find((u) => u.role === "admin")!;
  const manager2 = byUsername["manager2"] ?? freshUsers.find((u) => u.role === "project_manager")!;
  const manager3 = byUsername["manager3"] ?? freshUsers.filter((u) => u.role === "project_manager")[1] ?? manager2;
  const accountant4 = byUsername["accountant4"] ?? freshUsers.find((u) => u.role === "accountant")!;
  const accountant5 = byUsername["accountant5"] ?? freshUsers.filter((u) => u.role === "accountant")[1] ?? accountant4;
  const supervisor1 = byUsername["supervisor1"] ?? freshUsers.find((u) => u.role === "site_supervisor") ?? manager2;

  // ─── المشاريع ───────────────────────────────────────────────
  console.log("🏗️  إدخال المشاريع...");
  await db.insert(projects).values([
    { name: "برج الياسمين السكني", description: "برج سكني 25 طابق + 3 basements", client: "شركة الياسمين العقارية", location: "الرياض - حي الياسمين", status: "active", startDate: "2024-03-01", endDate: "2027-09-30", contractValue: "52000000", budgetAllocated: "44500000", progressPercent: 48 },
    { name: "مجمع النخيل التجاري", description: "مركز تجاري 4 طوابق + مواقف underground", client: "مجموعة النخيل القابضة", location: "جدة - طريق الملك عبدالعزيز", status: "active", startDate: "2023-11-15", endDate: "2026-06-30", contractValue: "38500000", budgetAllocated: "32000000", progressPercent: 72 },
    { name: "فيلات حي الملقا", description: "12 فيلا سكنية فاخرة", client: "مطورات الملقا", location: "الرياض - حي الملقا", status: "active", startDate: "2025-01-10", endDate: "2026-12-31", contractValue: "28000000", budgetAllocated: "24500000", progressPercent: 35 },
    { name: "مستشفى الأمل التخصصي", description: "مستشفى 200 سرير + OT + ICU", client: "وزارة الصحة", location: "مكة المكرمة", status: "completed", startDate: "2021-06-01", endDate: "2024-12-31", contractValue: "185000000", budgetAllocated: "168000000", progressPercent: 100 },
    { name: "توسعة طريق الوادي السريع", description: "12 كم طريق + 4 جسور", client: "وزارة النقل والخدمات اللوجستية", location: "القصيم - بريدة", status: "active", startDate: "2025-02-01", endDate: "2028-08-31", contractValue: "92000000", budgetAllocated: "81000000", progressPercent: 12 },
    { name: "مصنع الأغذية الجافة", description: "مصنع 8000 م² + cold storage", client: "شركة الغذاء الوطني", location: "الدمام - المنطقة الصناعية الثانية", status: "active", startDate: "2024-09-01", endDate: "2026-03-31", contractValue: "42000000", budgetAllocated: "38000000", progressPercent: 58 },
    { name: "مدرسة الأجيال الأهلية", description: "مدرسة ابتدائي ومتوسط - 36 فصل", client: "مؤسسة الأجيال التعليمية", location: "الخبر - العزيزية", status: "active", startDate: "2024-05-15", endDate: "2025-08-30", contractValue: "18500000", budgetAllocated: "16200000", progressPercent: 85 },
    { name: "فندق الواجهة البحرية", description: "فندق 5 نجوم 180 غرفة", client: "ضيافة الخليج", location: "جدة - الكورنيش", status: "on_hold", startDate: "2025-06-01", endDate: "2028-12-31", contractValue: "110000000", budgetAllocated: "95000000", progressPercent: 5 },
    { name: "محطة معالجة مياه شمال الرياض", description: "محطة 50,000 م³/يوم", client: "شركة المياه الوطنية", location: "الرياض - شمال المدينة", status: "active", startDate: "2023-08-01", endDate: "2026-11-30", contractValue: "76000000", budgetAllocated: "69000000", progressPercent: 61 },
    { name: "مجمع إسكان جazan", description: "450 وحدة سكنية + مرافق", client: "وزارة الإسكان", location: "جازان - الشاطئ", status: "active", startDate: "2024-01-20", endDate: "2027-04-30", contractValue: "145000000", budgetAllocated: "128000000", progressPercent: 38 },
    { name: "مبنى إداري أرامكو الفرعي", description: "G+8 مكاتب", client: "أرامكo السعودية", location: "الظهران", status: "completed", startDate: "2022-03-01", endDate: "2024-06-30", contractValue: "34000000", budgetAllocated: "31500000", progressPercent: 100 },
    { name: "ترميم قصر التراث", description: "ترميم وإعادة تأهيل تراثي", client: "هيئة التراث", location: "الدرعية - البجيري", status: "active", startDate: "2025-04-01", endDate: "2026-10-31", contractValue: "9800000", budgetAllocated: "8500000", progressPercent: 22 },
  ]);

  // إسناد المشاريع
  await db.insert(projectAssignments).values([
    { userId: manager2.id, projectId: 1 }, { userId: manager2.id, projectId: 2 },
    { userId: manager2.id, projectId: 6 }, { userId: manager2.id, projectId: 7 },
    { userId: manager3.id, projectId: 3 }, { userId: manager3.id, projectId: 5 },
    { userId: manager3.id, projectId: 9 }, { userId: manager3.id, projectId: 10 },
    { userId: manager3.id, projectId: 12 },
  ]);

  // تحديث مشرف الموقع
  if (supervisor1.id) {
    await db.update(users).set({ assignedProjectId: 1 }).where(eq(users.id, supervisor1.id));
  }

  // ─── فئات المصروفات ───────────────────────────────────────
  console.log("📂 فئات المصروفات...");
  await db.insert(expenseCategories).values([
    { name: "مواد بناء" }, { name: "عمالة" }, { name: "معدات" },
    { name: "نقل وشحن" }, { name: "خدمات هندسية" }, { name: "مصاريف إدارية" },
    { name: "وقود وزيوت" }, { name: "كهرباء ومياه موقع" }, { name: "سلامة مهنية" },
  ]);

  // ─── دليل البنود ───────────────────────────────────────────
  console.log("📚 دليل البنود...");
  await db.insert(catalogItems).values([
    { code: "C-001", name: "حفر وتسوية", unit: "م³", defaultUnitPrice: "45", defaultEstimatedPrice: "42", category: "أعمال ترابية" },
    { code: "C-002", name: "صب خرسانة الأساسات", unit: "م³", defaultUnitPrice: "480", defaultEstimatedPrice: "460", category: "خرسانة" },
    { code: "C-003", name: "تسليح حديد 16-25مم", unit: "طن", defaultUnitPrice: "4100", defaultEstimatedPrice: "3950", category: "حديد" },
    { code: "C-004", name: "أعمال البلوك والمasonry", unit: "م²", defaultUnitPrice: "85", defaultEstimatedPrice: "78", category: "بناء" },
    { code: "C-005", name: "لياسة داخلية وخارجية", unit: "م²", defaultUnitPrice: "35", defaultEstimatedPrice: "32", category: "تشطيب" },
    { code: "C-006", name: "أعمال تشطيب VIP", unit: "م²", defaultUnitPrice: "420", defaultEstimatedPrice: "400", category: "تشطيب" },
    { code: "C-007", name: "هيكل خرساني", unit: "م³", defaultUnitPrice: "520", defaultEstimatedPrice: "500", category: "خرسانة" },
    { code: "C-008", name: "واجهات زجاج وكلadding", unit: "م²", defaultUnitPrice: "680", defaultEstimatedPrice: "650", category: "واجهات" },
    { code: "C-009", name: "أعمال MEP", unit: "مقطوع", defaultUnitPrice: "4500000", defaultEstimatedPrice: "4200000", category: "MEP" },
    { code: "C-010", name: "تنسيق موقع وحدائق", unit: "م²", defaultUnitPrice: "120", defaultEstimatedPrice: "110", category: "تنسيق" },
    { code: "C-011", name: "ردم وتسوية طريق", unit: "م³", defaultUnitPrice: "28", defaultEstimatedPrice: "26", category: "طرق" },
    { code: "C-012", name: "طبقة أساس BC", unit: "م³", defaultUnitPrice: "95", defaultEstimatedPrice: "88", category: "طرق" },
    { code: "C-013", name: "رصف AC", unit: "م²", defaultUnitPrice: "42", defaultEstimatedPrice: "38", category: "طرق" },
    { code: "C-014", name: "هيكل فولاذي", unit: "طن", defaultUnitPrice: "5200", defaultEstimatedPrice: "5000", category: "معدني" },
    { code: "C-015", name: "أرضيات صناعية epoxy", unit: "م²", defaultUnitPrice: "145", defaultEstimatedPrice: "135", category: "تشطيب" },
    { code: "C-016", name: "لوحات كهرباء", unit: "لوح", defaultUnitPrice: "85000", defaultEstimatedPrice: "80000", category: "كهرباء" },
    { code: "C-017", name: "تمديدات إنارة وقوى", unit: "نقطة", defaultUnitPrice: "185", defaultEstimatedPrice: "170", category: "كهرباء" },
    { code: "C-018", name: "شبكة سباكة", unit: "م", defaultUnitPrice: "95", defaultEstimatedPrice: "88", category: "سباكة" },
    { code: "C-019", name: "عزل أسطح وخزانات", unit: "م²", defaultUnitPrice: "75", defaultEstimatedPrice: "70", category: "عزل" },
  ]);

  // ─── بنود المشاريع (BOQ) ──────────────────────────────────
  console.log("📋 بنود المشاريع...");
  const boqItems = [
    // مشروع 1 - برج الياسمين
    { projectId: 1, name: "حفر وتسوية", unit: "م³", quantity: "8500", unitPrice: "45", estimatedPrice: "42", executedPrice: "44" },
    { projectId: 1, name: "صب خرسانة الأساسات", unit: "م³", quantity: "3200", unitPrice: "480", estimatedPrice: "460", executedPrice: "475" },
    { projectId: 1, name: "تسليح حديد 16-25مم", unit: "طن", quantity: "1200", unitPrice: "4100", estimatedPrice: "3950", executedPrice: "4050" },
    { projectId: 1, name: "أعمال البلوك والمasonry", unit: "م²", quantity: "45000", unitPrice: "85", estimatedPrice: "78", executedPrice: "82" },
    { projectId: 1, name: "لياسة داخلية وخارجية", unit: "م²", quantity: "38000", unitPrice: "35", estimatedPrice: "32", executedPrice: "34" },
    { projectId: 1, name: "أعمال تشطيب VIP", unit: "م²", quantity: "8500", unitPrice: "420", estimatedPrice: "400", executedPrice: "415" },
    // مشروع 2
    { projectId: 2, name: "هيكل خرساني تجاري", unit: "م³", quantity: "5600", unitPrice: "520", estimatedPrice: "500", executedPrice: "510" },
    { projectId: 2, name: "واجهات زجاج وكلadding", unit: "م²", quantity: "6200", unitPrice: "680", estimatedPrice: "650", executedPrice: "670" },
    { projectId: 2, name: "أعمال MEP تجاري", unit: " lump", quantity: "1", unitPrice: "4500000", estimatedPrice: "4200000", executedPrice: "4350000" },
    // مشروع 3
    { projectId: 3, name: "فيلا - هيكل إنشائي", unit: "فيلا", quantity: "12", unitPrice: "850000", estimatedPrice: "820000", executedPrice: "840000" },
    { projectId: 3, name: "تنسيق موقع وحدائق", unit: "م²", quantity: "4800", unitPrice: "120", estimatedPrice: "110", executedPrice: "115" },
    // مشروع 5
    { projectId: 5, name: "ردم وتسوية طريق", unit: "م³", quantity: "850000", unitPrice: "28", estimatedPrice: "26", executedPrice: "27" },
    { projectId: 5, name: "طبقة أساس BC", unit: "م³", quantity: "120000", unitPrice: "95", estimatedPrice: "88", executedPrice: "92" },
    { projectId: 5, name: "رصف AC 5 سم", unit: "م²", quantity: "480000", unitPrice: "42", estimatedPrice: "38", executedPrice: "40" },
    // مشروع 6
    { projectId: 6, name: "هيكل فولاذي المصنع", unit: "طن", quantity: "850", unitPrice: "5200", estimatedPrice: "5000", executedPrice: "5100" },
    { projectId: 6, name: "أرضيات صناعية epoxy", unit: "م²", quantity: "7500", unitPrice: "145", estimatedPrice: "135", executedPrice: "140" },
    // مشروع 9
    { projectId: 9, name: "خزانات ومحطات Pump", unit: "وحدة", quantity: "8", unitPrice: "2800000", estimatedPrice: "2650000", executedPrice: "2720000" },
    { projectId: 9, name: "خطوط نقل HDPE", unit: "م", quantity: "12500", unitPrice: "380", estimatedPrice: "360", executedPrice: "370" },
  ];
  for (const item of boqItems) {
    await db.insert(projectItems).values({
      projectId: item.projectId, name: item.name, unit: item.unit,
      quantity: item.quantity, unitPrice: item.unitPrice,
      estimatedPrice: item.estimatedPrice, executedPrice: item.executedPrice,
    });
  }

  // ─── المقاولين ────────────────────────────────────────────
  console.log("👷 المقاولون...");
  await db.insert(contractors).values([
    { name: "مؤسسة البناء الحديث", companyName: "البناء الحديث للمقاولات", phone: "0114567890", email: "info@modernbuild.sa", specialty: "هيكل إنشائي", licenseNumber: "CR-100234", address: "الرياض - العليا", status: "active" },
    { name: "شركة الراجحي للمقاولات", companyName: "الراجحي للإنشاءات", phone: "0126789012", email: "projects@alrajhi-build.sa", specialty: "مقاول عام", licenseNumber: "CR-200456", address: "جدة - حي الروضة", status: "active" },
    { name: "مقاولات الكهرباء المتقدمة", companyName: "Advanced Electric Co.", phone: "0501234567", email: "contact@adv-electric.sa", specialty: "أعمال كهربائية", licenseNumber: "CR-300789", status: "active" },
    { name: "السباكة الذهبية", companyName: "Golden Plumbing Est.", phone: "0559876543", email: "sales@golden-plumb.sa", specialty: "سباكة وتكييف", licenseNumber: "CR-400112", status: "active" },
    { name: "شركة التشطيبات الفاخرة", companyName: "Luxury Finishes LLC", phone: "0543210987", specialty: "تشطيبات وديكور", licenseNumber: "CR-500334", status: "active" },
    { name: "مؤسسة الطرق والجسور", companyName: "Roads & Bridges Corp", phone: "0163456789", email: "bids@roads-br.sa", specialty: "طرق وجسور", licenseNumber: "CR-600556", address: "بريدة - الصناعية", status: "active" },
    { name: "حديد وإنشاءات الخليج", companyName: "Gulf Steel Contractors", phone: "0135678901", specialty: "هياكل معدنية", licenseNumber: "CR-700778", status: "active" },
    { name: "مقاولات MEP Integra", companyName: "Integra MEP", phone: "0508765432", email: "pm@integra-mep.sa", specialty: "MEP متكامل", licenseNumber: "CR-800990", status: "active" },
    { name: "أعمال الحفر والردم المتحدة", companyName: "United Earthworks", phone: "0552345678", specialty: "حفر وردم", licenseNumber: "CR-901221", status: "active" },
    { name: "شركة العزل والأسقف", companyName: "Insulation Pro", phone: "0567890123", specialty: "عزل مائي وحراري", status: "active" },
    { name: "مؤسسة النجارة والألمنيوم", companyName: "Wood & Alu Works", phone: "0545678901", specialty: "نجارة وألمنيوم", status: "active" },
    { name: "مقاولات صيانة المنشآت", companyName: "Facilities Maintenance Co.", phone: "0118901234", specialty: "صيانة", status: "inactive" },
  ]);

  // بنود المقاولين
  const contractItemsData = [
    { contractorId: 1, projectId: 1, itemCode: "STR-101", description: "صب خرسانة الأساسات والرقاب", unit: "م³", quantity: "3200", unitPrice: "475", completedQuantity: "1850", status: "in_progress" },
    { contractorId: 1, projectId: 1, itemCode: "STR-102", description: "أعمال الأعمدة والبلاطات", unit: "م³", quantity: "8500", unitPrice: "520", completedQuantity: "3200", status: "in_progress" },
    { contractorId: 2, projectId: 2, itemCode: "GEN-201", description: "هيكل خرساني مجمع تجاري", unit: "م³", quantity: "5600", unitPrice: "510", completedQuantity: "4200", status: "in_progress" },
    { contractorId: 3, projectId: 1, itemCode: "ELE-101", description: "لوحات كهرباء رئيسية وفرعية", unit: "لوح", quantity: "45", unitPrice: "85000", completedQuantity: "18", status: "in_progress" },
    { contractorId: 3, projectId: 2, itemCode: "ELE-201", description: "تمديدات إنارة وقوى", unit: "نقطة", quantity: "3200", unitPrice: "185", completedQuantity: "2800", status: "in_progress" },
    { contractorId: 4, projectId: 1, itemCode: "PLB-101", description: "شبكة سباكة صرف و supply", unit: "م", quantity: "8500", unitPrice: "95", completedQuantity: "5200", status: "in_progress" },
    { contractorId: 4, projectId: 3, itemCode: "PLB-301", description: "تكييف VRF للفلل", unit: "وحدة", quantity: "48", unitPrice: "18500", completedQuantity: "22", status: "pending" },
    { contractorId: 5, projectId: 1, itemCode: "FIN-101", description: "تشطيبات داخلية فاخرة", unit: "م²", quantity: "8500", unitPrice: "415", completedQuantity: "1200", status: "pending" },
    { contractorId: 6, projectId: 5, itemCode: "RD-501", description: "ردم ودك طبقات الطريق", unit: "م³", quantity: "850000", unitPrice: "27", completedQuantity: "95000", status: "in_progress" },
    { contractorId: 6, projectId: 5, itemCode: "RD-502", description: "رصف أسفلti", unit: "م²", quantity: "480000", unitPrice: "40", completedQuantity: "52000", status: "in_progress" },
    { contractorId: 7, projectId: 6, itemCode: "STL-601", description: "تركيب هيكل فولاذي", unit: "طن", quantity: "850", unitPrice: "5100", completedQuantity: "620", status: "in_progress" },
    { contractorId: 8, projectId: 9, itemCode: "MEP-901", description: "أعمال MEP محطة المياه", unit: "lump", quantity: "1", unitPrice: "8500000", completedQuantity: "0.65", status: "in_progress" },
    { contractorId: 9, projectId: 10, itemCode: "EWK-1001", description: "حفر وردم موقع الإسكان", unit: "م³", quantity: "420000", unitPrice: "22", completedQuantity: "165000", status: "in_progress" },
    { contractorId: 1, projectId: 7, itemCode: "SCH-701", description: "هيكل مدرسة خرساني", unit: "م³", quantity: "2800", unitPrice: "495", completedQuantity: "2650", status: "in_progress" },
    { contractorId: 10, projectId: 1, itemCode: "INS-101", description: "عزل أسطح وخزانات", unit: "م²", quantity: "4200", unitPrice: "75", completedQuantity: "3800", status: "in_progress" },
  ];
  for (const ci of contractItemsData) {
    await db.insert(contractItems).values({
      contractorId: ci.contractorId, projectId: ci.projectId, itemCode: ci.itemCode,
      description: ci.description, unit: ci.unit, quantity: ci.quantity,
      unitPrice: ci.unitPrice, completedQuantity: ci.completedQuantity, status: ci.status,
    });
  }

  // ─── الموردين ─────────────────────────────────────────────
  console.log("🚚 الموردون...");
  await db.insert(suppliers).values([
    { name: "مصنع الحديد الوطني", companyName: "National Steel Factory", phone: "0112003344", category: "حديد ومعادن", address: "الرياض - الصناعية", status: "active" },
    { name: "شركة الإسمنت السعودية", companyName: "Saudi Cement Co.", phone: "0123004455", category: "إسمنت ومواد", status: "active" },
    { name: "مؤسسة العدد والأدوات", companyName: "Tools & Equipment Est.", phone: "0134005566", category: "عدد ومعدات", status: "active" },
    { name: "مواد البناء المتحدة", companyName: "United Building Materials", phone: "0115006677", category: "مواد بناء", status: "active" },
    { name: "شركة الكابلات السعودية", companyName: "Saudi Cables", phone: "0116007788", category: "كهرباء", status: "active" },
    { name: "مؤسسة الرمل والسحق", companyName: "Sand & Aggregate Est.", phone: "0167008899", category: "سحق و رمل", status: "active" },
    { name: "الدهانات والعازل", companyName: "Paints & Insulation Co.", phone: "0128009900", category: "دهانات وعزل", status: "active" },
    { name: "معدات ثقيلة للتأجير", companyName: "Heavy Equipment Rental", phone: "0509112233", category: "تأجير معدات", status: "active" },
    { name: "أخشاب وبلاستيك البناء", companyName: "Formwork Supplies", phone: "0558223344", category: "قوالب وخشب", status: "active" },
    { name: "مولدات وطاقة موقع", companyName: "Site Power Solutions", phone: "0549334455", category: "طاقة", status: "active" },
    { name: "سلامة مهنية - SafePro", companyName: "SafePro Safety", phone: "0560445566", category: "سلامة", status: "active" },
    { name: "خرسانة جاهزة الرياض", companyName: "Riyadh Ready Mix", phone: "0111556677", category: "خرسانة", status: "active" },
    { name: "بلاط وبورسلان الخليج", companyName: "Gulf Tiles", phone: "0122667788", category: "تشطيبات", status: "active" },
    { name: "مضخات ومواسير HDPE", companyName: "PipeTech Supply", phone: "0133778899", category: "مواسير", status: "active" },
    { name: "وقود وزيوت موقع", companyName: "Site Fuel Services", phone: "0504889900", category: "وقود", status: "active" },
  ]);

  // ─── المشتريات ────────────────────────────────────────────
  console.log("🛒 المشتريات...");
  const purchaseList = [
    { supplierId: 1, projectId: 1, purchaseNumber: "PO-2025-001", title: "حديد تسليح 16-32مم", amount: "1250000", paidAmount: "1250000", status: "received", paymentStatus: "paid", orderDate: "2025-01-15", actualDelivery: "2025-01-28" },
    { supplierId: 2, projectId: 1, purchaseNumber: "PO-2025-002", title: "إسمنت OPC 5000 طن", amount: "680000", paidAmount: "680000", status: "received", paymentStatus: "paid", orderDate: "2025-02-01", actualDelivery: "2025-02-10" },
    { supplierId: 12, projectId: 1, purchaseNumber: "PO-2025-003", title: "خرسانة جاهزة C30", amount: "920000", paidAmount: "550000", status: "received", paymentStatus: "partial", orderDate: "2025-02-20", actualDelivery: "2025-03-05" },
    { supplierId: 3, projectId: 2, purchaseNumber: "PO-2025-004", title: "عدد كهربائية ويدوية", amount: "85000", paidAmount: "85000", status: "received", paymentStatus: "paid", orderDate: "2025-03-01", actualDelivery: "2025-03-08" },
    { supplierId: 4, projectId: 2, purchaseNumber: "PO-2025-005", title: "بلاط ومواد تشطيب", amount: "420000", paidAmount: "200000", status: "received", paymentStatus: "partial", orderDate: "2025-03-15", actualDelivery: "2025-04-01" },
    { supplierId: 6, projectId: 5, purchaseNumber: "PO-2025-006", title: "سحق وردم 50000 م³", amount: "1100000", paidAmount: "400000", status: "received", paymentStatus: "partial", orderDate: "2025-04-01", actualDelivery: "2025-04-20" },
    { supplierId: 8, projectId: 5, purchaseNumber: "PO-2025-007", title: "تأجير bulldozer 3 أشهر", amount: "285000", paidAmount: "285000", status: "received", paymentStatus: "paid", orderDate: "2025-04-10", actualDelivery: "2025-04-12" },
    { supplierId: 1, projectId: 6, purchaseNumber: "PO-2025-008", title: "حديد هيكل معدني 400 طن", amount: "1680000", paidAmount: "800000", status: "received", paymentStatus: "partial", orderDate: "2025-02-05", actualDelivery: "2025-02-25" },
    { supplierId: 5, projectId: 9, purchaseNumber: "PO-2025-009", title: "كابلات ولوحات كهرباء", amount: "560000", paidAmount: "0", status: "ordered", paymentStatus: "unpaid", orderDate: "2025-05-01", expectedDelivery: "2025-06-15" },
    { supplierId: 14, projectId: 9, purchaseNumber: "PO-2025-010", title: "مواسير HDPE 800مم", amount: "890000", paidAmount: "890000", status: "received", paymentStatus: "paid", orderDate: "2025-03-20", actualDelivery: "2025-04-05" },
    { supplierId: 11, projectId: 7, purchaseNumber: "PO-2025-011", title: "معدات سلامة موقع", amount: "45000", paidAmount: "45000", status: "received", paymentStatus: "paid", orderDate: "2025-01-10", actualDelivery: "2025-01-15" },
    { supplierId: 13, projectId: 3, purchaseNumber: "PO-2025-012", title: "بورسلان فلل - 12 unit", amount: "720000", paidAmount: "360000", status: "ordered", paymentStatus: "partial", orderDate: "2025-05-10", expectedDelivery: "2025-06-30" },
    { supplierId: 15, projectId: 1, purchaseNumber: "PO-2025-013", title: "ديزل موقع - 3 أشهر", amount: "95000", paidAmount: "95000", status: "received", paymentStatus: "paid", orderDate: "2025-03-01", actualDelivery: "2025-03-01" },
    { supplierId: 7, projectId: 10, purchaseNumber: "PO-2025-014", title: "دهانات وعزل خارجي", amount: "380000", paidAmount: "0", status: "draft", paymentStatus: "unpaid", orderDate: "2025-06-01" },
    { supplierId: 9, projectId: 12, purchaseNumber: "PO-2025-015", title: "خشب قوالب ترميم", amount: "125000", paidAmount: "62500", status: "received", paymentStatus: "partial", orderDate: "2025-05-05", actualDelivery: "2025-05-12" },
  ];
  for (const p of purchaseList) {
    await db.insert(purchases).values(p);
  }

  // ─── المصروفات ────────────────────────────────────────────
  console.log("💰 المصروفات...");
  const expenseTemplates = [
    { projectId: 1, title: "إيجار رافعة برجية Liebherr", category: "معدات", amount: 85000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-01-20" },
    { projectId: 1, title: "أجور عمالة يومية - 45 عامل", category: "عمالة", amount: 52000, status: "approved", submitter: supervisor1, manager: admin.name, accountant: accountant4.name, date: "2025-02-05" },
    { projectId: 1, title: "وقود مولدات موقع", category: "وقود وزيوت", amount: 18500, status: "approved", submitter: supervisor1, manager: admin.name, accountant: accountant5.name, date: "2025-02-15" },
    { projectId: 1, title: "استشارة هندسية إنشائية", category: "خدمات هندسية", amount: 35000, status: "manager_approved", submitter: manager2, manager: admin.name, date: "2025-03-01" },
    { projectId: 1, title: "نقل مواد - 8 طloads", category: "نقل وشحن", amount: 12000, status: "pending", submitter: supervisor1, date: "2025-03-10" },
    { projectId: 2, title: "تأجير scaffold 2 شهر", category: "معدات", amount: 68000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-02-01" },
    { projectId: 2, title: "مصاريف إدارية موقع", category: "مصاريف إدارية", amount: 8500, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-02-20" },
    { projectId: 2, title: "كهرباء ومياه مؤقتة", category: "كهرباء ومياه موقع", amount: 22000, status: "manager_approved", submitter: manager2, manager: admin.name, date: "2025-03-05" },
    { projectId: 3, title: "شراء مواد سباكة طارئة", category: "مواد بناء", amount: 14500, status: "pending", submitter: manager3, date: "2025-04-01" },
    { projectId: 3, title: "معدات حفر فيlla 4", category: "معدات", amount: 28000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant5.name, date: "2025-03-15" },
    { projectId: 5, title: "مسح topographic", category: "خدمات هندسية", amount: 95000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant4.name, date: "2025-02-10" },
    { projectId: 5, title: "علاقات حكومية - رخص", category: "مصاريف إدارية", amount: 42000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant4.name, date: "2025-01-25" },
    { projectId: 6, title: "crane mobile 200 ton", category: "معدات", amount: 125000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant5.name, date: "2025-01-30" },
    { projectId: 6, title: "اختبارات soil و concrete", category: "خدمات هندسية", amount: 38000, status: "manager_approved", submitter: manager2, manager: admin.name, date: "2025-03-20" },
    { projectId: 7, title: "أثاث مكتب موقع مؤقت", category: "مصاريف إدارية", amount: 15000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-02-08" },
    { projectId: 9, title: "PPE موقع - 200 set", category: "سلامة مهنية", amount: 28000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant5.name, date: "2025-02-18" },
    { projectId: 9, title: "نقل معدات ثقيلة", category: "نقل وشحن", amount: 65000, status: "pending", submitter: manager3, date: "2025-04-05" },
    { projectId: 10, title: "سكن عمال - 3 أشهر", category: "عمالة", amount: 96000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant4.name, date: "2025-01-15" },
    { projectId: 10, title: "صيانة شاحنات نقل", category: "معدات", amount: 18500, status: "rejected", submitter: manager3, date: "2025-03-01" },
    { projectId: 12, title: "مواد ترميم تراثي", category: "مواد بناء", amount: 78000, status: "manager_approved", submitter: manager3, manager: admin.name, date: "2025-05-01" },
    { projectId: 1, title: "ضيافة وفحص consultants", category: "مصاريف إدارية", amount: 6500, status: "pending", submitter: supervisor1, date: "2025-04-12" },
    { projectId: 2, title: "تصريf دفاع مدني", category: "مصاريف إدارية", amount: 22000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-03-25" },
    { projectId: 5, title: "Traffic management plan", category: "خدمات هندسية", amount: 55000, status: "pending", submitter: manager3, date: "2025-04-20" },
    { projectId: 6, title: "Labor camp utilities", category: "كهرباء ومياه موقع", amount: 32000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant5.name, date: "2025-04-01" },
    { projectId: 7, title: "Final inspection fees", category: "مصاريف إدارية", amount: 18000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-05-10" },
  ];

  for (const e of expenseTemplates) {
    await db.insert(expenses).values({
      projectId: e.projectId,
      title: e.title,
      amount: String(e.amount),
      category: e.category,
      status: e.status,
      submittedBy: e.submitter.name,
      submittedById: e.submitter.id,
      managerApprovedBy: e.manager ?? null,
      managerApprovedAt: e.manager ? new Date(e.date) : null,
      accountantApprovedBy: e.accountant ?? null,
      accountantApprovedAt: e.accountant ? new Date(e.date) : null,
      approvedBy: e.accountant ?? null,
      expenseDate: e.date,
    });
  }

  // ─── العهد ────────────────────────────────────────────────
  console.log("💼 العهد...");
  const pettyCashList = [
    { assignedToId: manager2.id, assignedTo: manager2.name, issuedById: accountant4.id, purpose: "مصاريف موقع طارئة - برج الياسمين", allocatedAmount: 25000, usedAmount: 14200, status: "open", issuedDate: "2025-01-05", projectId: 1 },
    { assignedToId: manager2.id, assignedTo: manager2.name, issuedById: accountant4.id, purpose: "مشتريات صغيرة مجمع النخيل", allocatedAmount: 15000, usedAmount: 15000, status: "settled", issuedDate: "2025-02-01", settledDate: "2025-02-28", settledById: accountant4.id, projectId: 2 },
    { assignedToId: supervisor1.id, assignedTo: supervisor1.name, issuedById: accountant5.id, purpose: "مصاريف يومية موقع البرج", allocatedAmount: 8000, usedAmount: 5200, status: "open", issuedDate: "2025-02-15", projectId: 1 },
    { assignedToId: manager3.id, assignedTo: manager3.name, issuedById: accountant4.id, purpose: "عهدة فيlas الملقا", allocatedAmount: 20000, usedAmount: 8500, status: "open", issuedDate: "2025-03-01", projectId: 3 },
    { assignedToId: manager3.id, assignedTo: manager3.name, issuedById: accountant5.id, purpose: "عهدة طريق الوادي", allocatedAmount: 35000, usedAmount: 22000, status: "open", issuedDate: "2025-03-10", projectId: 5 },
    { assignedToId: manager2.id, assignedTo: manager2.name, issuedById: accountant4.id, purpose: "عهدة مصنع الأغذية", allocatedAmount: 18000, usedAmount: 18000, status: "settled", issuedDate: "2025-01-20", settledDate: "2025-03-15", settledById: accountant5.id, projectId: 6 },
    { assignedToId: manager3.id, assignedTo: manager3.name, issuedById: accountant4.id, purpose: "عهدة محطة المياه", allocatedAmount: 12000, usedAmount: 4800, status: "open", issuedDate: "2025-04-01", projectId: 9 },
    { assignedToId: manager3.id, assignedTo: manager3.name, issuedById: accountant5.id, purpose: "عهدة إسكان جazan", allocatedAmount: 40000, usedAmount: 28500, status: "open", issuedDate: "2025-02-01", projectId: 10 },
    { assignedToId: supervisor1.id, assignedTo: supervisor1.name, issuedById: accountant4.id, purpose: "عهدة سلامة وPPE", allocatedAmount: 5000, usedAmount: 5000, status: "settled", issuedDate: "2025-01-10", settledDate: "2025-02-05", settledById: accountant4.id },
    { assignedToId: manager2.id, assignedTo: manager2.name, issuedById: accountant5.id, purpose: "عهدة مدرسة الأجيال", allocatedAmount: 10000, usedAmount: 6200, status: "open", issuedDate: "2025-03-20", projectId: 7 },
  ];
  for (const pc of pettyCashList) {
    await db.insert(pettyCash).values({
      ...pc,
      allocatedAmount: String(pc.allocatedAmount),
      usedAmount: String(pc.usedAmount),
    });
  }

  // ─── المستخلصات ───────────────────────────────────────────
  console.log("📄 المستخلصات...");
  const extractList = [
    { projectId: 1, contractorId: 1, extractNumber: "EXT-2025-001", title: "مستخلص 1 - أعمال الأساسات", amount: 1450000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-02-28", paidAt: "2025-03-15" },
    { projectId: 1, contractorId: 1, extractNumber: "EXT-2025-002", title: "مستخلص 2 - أعمدة الدور 1-5", amount: 2180000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant5.name, date: "2025-04-10", paidAt: "2025-04-25" },
    { projectId: 1, contractorId: 3, extractNumber: "EXT-2025-003", title: "مستخلص كهرباء - مرحلة 1", amount: 385000, status: "manager_approved", submitter: manager2, manager: admin.name, date: "2025-04-20" },
    { projectId: 1, contractorId: 4, extractNumber: "EXT-2025-004", title: "مستخلص سباكة - 60%", amount: 492000, status: "submitted", submitter: manager2, date: "2025-05-01" },
    { projectId: 2, contractorId: 2, extractNumber: "EXT-2025-005", title: "مستخلص هيكل تجاري - 75%", amount: 2850000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-03-20", paidAt: "2025-04-05" },
    { projectId: 2, contractorId: 3, extractNumber: "EXT-2025-006", title: "مستخلص إنارة - 85%", amount: 518000, status: "manager_approved", submitter: manager2, manager: admin.name, date: "2025-05-05" },
    { projectId: 3, contractorId: 4, extractNumber: "EXT-2025-007", title: "مستخلص تكييف فلل - 45%", amount: 407000, status: "submitted", submitter: manager3, date: "2025-04-15" },
    { projectId: 5, contractorId: 6, extractNumber: "EXT-2025-008", title: "مستخلص رdm - KM 0-3", amount: 2565000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant5.name, date: "2025-04-01", paidAt: "2025-04-20" },
    { projectId: 5, contractorId: 6, extractNumber: "EXT-2025-009", title: "مستخلص رصف - KM 0-1", amount: 2080000, status: "draft", submitter: manager3, date: "2025-05-10" },
    { projectId: 6, contractorId: 7, extractNumber: "EXT-2025-010", title: "مستخلص هيكل معدني - 73%", amount: 3162000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-03-30", paidAt: "2025-04-15" },
    { projectId: 7, contractorId: 1, extractNumber: "EXT-2025-011", title: "مستخلص مدرسة - 95%", amount: 1312500, status: "manager_approved", submitter: manager2, manager: admin.name, date: "2025-05-01" },
    { projectId: 9, contractorId: 8, extractNumber: "EXT-2025-012", title: "مستخلص MEP - 65%", amount: 5525000, status: "submitted", submitter: manager3, date: "2025-04-25" },
    { projectId: 10, contractorId: 9, extractNumber: "EXT-2025-013", title: "مستخلص حفر - 39%", amount: 3630000, status: "approved", submitter: manager3, manager: admin.name, accountant: accountant5.name, date: "2025-03-15", paidAt: "2025-04-01" },
    { projectId: 1, contractorId: 5, extractNumber: "EXT-2025-014", title: "مستخلص تشطيب - 14%", amount: 495000, status: "draft", submitter: manager2, date: "2025-05-15" },
    { projectId: 1, contractorId: 10, extractNumber: "EXT-2025-015", title: "مستخلص عزل - 90%", amount: 285000, status: "approved", submitter: manager2, manager: admin.name, accountant: accountant4.name, date: "2025-04-05", paidAt: "2025-04-18" },
  ];

  for (const ex of extractList) {
    await db.insert(extracts).values({
      projectId: ex.projectId,
      contractorId: ex.contractorId,
      extractNumber: ex.extractNumber,
      title: ex.title,
      amount: String(ex.amount),
      status: ex.status,
      submittedBy: ex.submitter.name,
      submittedById: ex.submitter.id,
      managerApprovedBy: ex.manager ?? null,
      managerApprovedAt: ex.manager ? new Date(ex.date) : null,
      accountantApprovedBy: ex.accountant ?? null,
      accountantApprovedAt: ex.accountant ? new Date(ex.date) : null,
      approvedBy: ex.accountant ?? null,
      extractDate: ex.date,
      paidAt: ex.paidAt ?? null,
    });
  }

  // بنود المستخلصات
  console.log("📝 بنود المستخلصات...");
  const lineItems = [
    { extractId: 1, description: "صب خرسانة أساسات", unit: "م³", quantity: "1850", unitPrice: "475", amount: "878750" },
    { extractId: 1, description: "تسليح أساسات", unit: "طن", quantity: "420", unitPrice: "4050", amount: "1701000" },
    { extractId: 2, description: "أعمدة وبلاطات", unit: "م³", quantity: "3200", unitPrice: "520", amount: "1664000" },
    { extractId: 2, description: "تسليح أعمدة", unit: "طن", quantity: "120", unitPrice: "4100", amount: "492000" },
    { extractId: 3, description: "لوحات كهرباء", unit: "لوح", quantity: "18", unitPrice: "85000", amount: "1530000" },
    { extractId: 5, description: "هيكل خرساني", unit: "م³", quantity: "4200", unitPrice: "510", amount: "2142000" },
    { extractId: 8, description: "ردم ودك", unit: "م³", quantity: "95000", unitPrice: "27", amount: "2565000" },
    { extractId: 10, description: "هيكل فولاذي", unit: "طن", quantity: "620", unitPrice: "5100", amount: "3162000" },
    { extractId: 13, description: "حفر وردم", unit: "م³", quantity: "165000", unitPrice: "22", amount: "3630000" },
  ];
  for (const li of lineItems) {
    await db.insert(extractLineItems).values({
      extractId: li.extractId,
      description: li.description,
      unit: li.unit,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
    });
  }

  console.log("\n✅ تمت إعادة تعبئة البيانات بنجاح (المستخدمون محفوظون)!");
  console.log("   📊 12 مشروع | 18 بند BOQ | 12 مقاول | 15 بند مقاول");
  console.log("   📊 15 مورد | 15 مشتري | 25 مصروف | 10 عهد | 15 مستخلص");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ خطأ:", err);
  process.exit(1);
});
