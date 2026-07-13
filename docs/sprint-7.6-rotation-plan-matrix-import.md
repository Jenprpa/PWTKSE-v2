# Sprint 7.6 - Rotation Plan Matrix Import Wizard

## Supported source formats

- Original matrix spreadsheet: `.xlsx` only.
- Normalized flat spreadsheet: `.xlsx` and `.csv`.
- Matrix files use column 1 as week, column 2 as date, and remaining columns as learning bases.
- Flat files use columns: `week`, `date`, `learningBaseName`, `classroomName`, `location`, `scheduleStatus`.

## Matrix parsing rules

- The parser detects the header row by finding columns that contain week and date labels.
- Learning-base columns are matched against existing active/inactive `bases` records by normalized Thai text.
- Supported school-specific base headers include:
  - ไฟเบอร์ ทรงพลัง
  - อาณาจักรอักษร
  - เงาในน้ำ
  - ไก่ไข่อารมณ์ดี
  - หรรษา สุธารสเห็ด
  - ต้นกล้า ประชาธิปไตย
  - หลู่สู่จากนาเกลือเกื้อบุญ
- `.xlsx` matrix parsing reads merged cells and copies the merged value into each affected week/cell.
- Line breaks inside cells are preserved as source text.
- Formatting colors are ignored as business logic.

## Classroom-expression examples

- `ม.2/1` becomes one classroom.
- `ม.2/1 ม.2/9` becomes two classrooms.
- `ม.2/2-4` expands to `ม.2/2`, `ม.2/3`, `ม.2/4`.
- `ม.3/5 ม.3/6` becomes two classrooms.
- `ม.6/1 ม.6/6` becomes two classrooms.
- Standalone grade groups such as `ม.1` expand to every active classroom whose display name starts with that grade.
- Unknown classrooms are shown as blocking errors in the preview.
- Standalone grade expansion is shown as a warning so admin can review before import.

## Location parsing

- Locations are kept as preview text after removing classroom expressions and known special-state words.
- Examples supported as free text:
  - ห้อง 2206
  - ห้องสมุด
  - ห้อง 2202-2203
  - ห้องประชุมธนี พหลโยธิน
  - ห้องคอมพิวเตอร์ 1 4101
  - หอประชุม
- Unknown locations are allowed.
- If one cell has multiple classrooms and multiple room numbers, the preview shows a warning when mapping is ambiguous.

## Special schedule states

Supported statuses:

- `active`
- `empty`
- `preparation`
- `teacher_presentation`
- `online`
- `midterm_exam`
- `public_holiday`
- `final_exam`

The import does not create active assignments for:

- ว่าง
- สอบกลางภาค
- วันหยุดราชการ
- สอบปลายภาค
- online weeks

## Firestore collection used

Valid active rows are written to the existing `rotationPlans` collection.

Fields written preserve the existing attendance workflow:

- `rotationId`
- `academicTermId`
- `weekNumber`
- `classroomId`
- `classroomName`
- `baseId`
- `baseName`
- `teacherUid`
- `teacherName`
- `active`
- `createdAt`
- `updatedAt`

Location and source-cell metadata are currently preview-only to avoid changing the production attendance workflow.

## Manual review rules

Admin must review rows with:

- warning text
- blocking errors
- standalone grade groups
- ambiguous classroom-to-room mapping
- unknown classroom
- unknown learning base
- duplicate classroom assignment in the same week
- duplicate existing Firestore assignment

Admin can edit preview values before import:

- week
- date
- learning base
- classroom
- location
- schedule status

## Import modes

- Add new valid assignments: imports only valid active rows and keeps existing records.
- Replace selected term/weeks: deletes existing `rotationPlans` for the active term and selected weeks, then imports the valid active rows.
- Replace mode shows a destructive confirmation summary before writing.
- Writes use safe batch size of 400 records.

## Known ambiguities and risks

- If a school cell has multiple classrooms and multiple room numbers, the system cannot always know which classroom belongs to which room.
- Location is not stored in Firestore yet because the current production schema and teacher workflow do not consume it.
- If base names in the spreadsheet differ materially from Firestore base names, admin must edit rows in preview or rename bases before import.
- If a merged cell contains a special state and classroom text together, admin should review the inferred status.
- The parser intentionally does not use color formatting as business logic.

## Admin operating steps

1. Log in as admin.
2. Open `/admin/rotation-plans/import`.
3. Choose import mode:
   - Original matrix spreadsheet
   - Normalized flat spreadsheet
4. Choose write mode:
   - Add new valid assignments
   - Replace selected term/weeks
5. Upload the file.
6. Review summary, warnings, and errors.
7. Edit preview rows where needed.
8. Confirm import.
9. Verify imported rows in Admin rotation plan list and Reports/Teacher flow.

## Development test checklist

- Merged cells across weeks: parser carries merged value into affected cells.
- Multi-line cells: source text keeps line breaks and parses classroom/location text.
- Classroom ranges: `ม.2/2-4` expands to three rooms.
- Multiple classrooms: `ม.2/1 ม.2/9` creates two preview rows.
- `ว่าง`: shown as `empty` and not imported.
- Midterm exam: shown as `midterm_exam` and not imported.
- Public holiday: shown as `public_holiday` and not imported.
- Final exam: shown as `final_exam` and not imported.
- Missing classroom: blocking error.
- Duplicate classroom assignment in same week: blocking error.
- Ambiguous room mapping: warning.
