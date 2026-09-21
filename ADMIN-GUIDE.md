# MedPath by Vidyarthi Mitra: data entry and admin operations

## One-time setup for this update

Use MongoDB Atlas or a MongoDB replica set. Standalone MongoDB cannot support atomic batch publishing. Install dependencies in both backend and frontend. Then, from `backend`, run:

```sh
npm run prepare:imports
```

This additive migration creates the import collections, required unique indexes and the catalog publication lock. It does not seed demo data, remove indexes or rewrite existing colleges. A duplicate existing college code blocks setup so it can be investigated. The application refuses draft writes if required storage is missing. Run this command against the intended environment as part of deployment, then restart the backend and worker. This command is covered by isolated integration tests. The additive setup for the hostel/bond update was also completed against the configured database on 2026-09-13; catalog records were not changed. Repeat setup when deploying to a different database.

For the main administrator, first sign up using the intended email/phone, then run:

```sh
npm run make-admin -- your-email@example.com
```

Use the exact identifier used to sign up. Log out and log in again. The promotion script creates the required admin role without adding sample data. Start the backend with `npm run dev` locally (or `npm start` in production), frontend with `npm run dev` locally, and a separate backend worker using `npm run worker`.

## Roles

To appoint another full administrator, open **Users -> Admin access** (also available in **Site settings**), enter the existing user's registered email or phone with country code, click **Make admin**, and confirm. Full admins can manage the entire platform, including other admins. Use **Remove admin access** beside a member to return them to a student account; their account, purchases and saved data remain. Removal takes effect on the next admin API request, including existing login sessions. The user can refresh the website after promotion to see the Admin tab. Your own admin access cannot be changed here. Only full administrators can grant or revoke full admin access; data-entry access remains separate below. Every change is audited and atomic.

| Account | Available work |
| --- | --- |
| Main administrator (`super_admin`) | Analytics, all published catalog tables, every import batch, review/publish, subscriptions/coupons, counselling operations, users and site settings |
| Data-entry administrator (`data_editor`) | Data entry workspace, college-code directory, own drafts, spreadsheet/image uploads, validation, error reports and submission |
| Student | Public/student website and purchased access; no administrative APIs |

In **Site settings -> Data-entry team**, enter the email of an existing active registered user and grant access. They must sign in again. The main admin can remove this access; import history remains. An account with a different admin role cannot be silently replaced from this screen. Data editors cannot publish, read another operator's batch, access finance or change roles, even if an old role record contains broad permissions. A main admin can prepare and publish their own batch when working alone.

## What links the different Excel files?

Every college has one permanent website code, for example `COL-MH-001`. Use it across fee, course-link, seat and cutoff sheets. Open **Data entry**, choose a section and expand **Find a college code** to search or download codes. In a form, **Use code** fills the selected college code. Existing colleges without a custom code use their existing 24-character database ID: no migration of existing references is needed.

Do not invent a new code for an existing college. Search by name and city first. College names can differ in external files; codes are the preferred match. Alternatively, map both `collegeName` and `city`: an exact unambiguous catalog match or an already-approved source alias can resolve them. Uncertain matches are blocked, never guessed.

To approve an external naming variation, map its original `collegeName` and `city`, then correct `collegeCode` in the affected draft row using the directory. The reviewer sees the proposed alias. Publishing saves that alias for the same exact source label. Another authority/source is a separate namespace. Conflicting aliases block publication; they are not silently reassigned.

| Dataset | Identifying fields | Publish first |
| --- | --- | --- |
| Courses | lowercase `slug`, such as `mbbs` | Nothing |
| Colleges | permanent `collegeCode` (existing ID also accepted) | Nothing |
| College-course links | college + course | Colleges and courses |
| Fees | college-course link + year + tier | Links |
| Hostel + mess (inside Fees) | college + year, shared across courses/tiers | Included through optional `hostelMess` in the Fees sheet |
| Service bonds | college-course link | Links |
| Seat matrix | link + authority + category + quota + round + year | Links |
| Cutoffs | link + category + quota + authority + year + round | Links |

Same identifying fields mean an update; a new year or round means a separate record. Historical data is retained. The website's cutoff tab continues reading the published CutOff collection, with its existing subscription checks. Drafts are stored separately.

## Recommended first upload

The supplied **[50-course master workbook](samples/catalogue/medical-courses-after-12th.xlsx)** covers nursing, pharmacy and allied-health options as well as MBBS/BDS/AYUSH. If already published, reuse the existing slugs instead of creating duplicates. See [catalogue notes](samples/catalogue/README.md). Courses now also accept optional `discipline`, `level`, `admissionRoute`, `admissionNotes`, `aliases`, `sourceUrls` and `reviewedOn` fields; the downloadable sample includes these columns. Course groups and college filters read published courses from the database. The NEET predictor and premium cutoff workflow retain their existing scope.

1. Publish **Courses**, with stable slugs (`mbbs`, `bds`, etc.).
2. Publish **Colleges**, assigning permanent codes. Use `isActive=false` for colleges that should remain hidden while details are prepared.
3. Publish **College-course links** with actual total sanctioned seats.
4. Publish **Fees**, **Seat matrix** and **Cutoffs** in separate batches. Match the source's actual year, quota, authority, category and round.
   Include `hostelMess` in the same **Fees** row as `tuition` and `otherCharges` (annual combined hostel/mess INR). Publish **Service bonds** using `collegeCode`, `courseSlug`, `years`, `penaltyAmount` and optional `applicableStates` separated by `|`. Enter zero years/penalty only when the source explicitly says there is no bond. Unknown bond years and penalties display as N/A independently. Bonds store the current terms for that college-course; hostel fees retain separate yearly records.
5. Add college photos and check Overview for missing images, fees and cutoffs.

In **Overview → Data needs attention**, click a count to open its filtered records. Photos shows published colleges with no saved images. Fees/cutoffs shows college-course links with no published record in any year (not unique college counts or a current-year completeness check). Search by college name/code, paginate or export the filtered page; **Clear attention filter** restores the full list. **Edit via draft** adds missing photos. **Add fees / Add cutoff** opens a manual form with the college code and course already filled; source, year and other required details still need entry and normal review/publication. After publication, refresh the list or Overview to see updated remaining counts.
6. When a college is ready, use **Colleges & photos -> Edit via draft**, set `isActive=true`, validate, submit and publish.
7. Inspect the public college and cutoff pages with free and subscribed accounts.

A multi-sheet workbook is imported one worksheet at a time. Each dataset is reviewed and published separately; there is no implicit multi-file transaction. Related master records must already be published, even if the college itself is hidden.

## Spreadsheet or manual entry: exact workflow

1. Open **Data entry** and choose **Colleges**, **Courses**, **College courses**, **Fees**, **Seats**, **Cutoffs** or **Service bonds**. Fees has one form and one sample Excel sheet, with `tuition`, `otherCharges` and optional `hostelMess` together. Hostel fees have no separate entry selector or top-level tab.
2. Choose **Upload Excel** for many records or **Fill a form** for one record. Forms show the important fields first; extra fields are under **More details (optional)**. College forms and correction rows include an **Add college photo** upload.
3. For an upload, use **Download sample Excel** and replace the sample rows. Every section has its own workbook; offline copies remain in `samples/imports`. Choose `.xlsx` or UTF-8 `.csv`. Worksheets are read automatically; choose the intended sheet if more than one is found. Save older `.xls` files as `.xlsx` first.
4. Enter **Data source**, such as the official notice or prospectus name. **Add source link (optional)** accepts its HTTPS URL. Keep source labels consistent when reusing approved aliases.
5. Choose **Check & preview**. This saves a private draft and automatically validates it. Exact sample headings are matched automatically. Nothing is published at this step. If checking fails, the saved entry remains available in **Entry history**.
6. If your original Excel uses different headings, expand **Match your spreadsheet columns** / **Column settings**. Match only the fields needed, such as `Institute Code -> College code`. Defaults apply only to blank cells. Never guess missing categories, quotas or rounds. Save personal column settings for reuse when helpful, then choose **Save & check again**.
7. Open any highlighted row to correct its fields. **View changes before publishing** shows previous and new values. Choose **Save & check again** after corrections. Every row must pass before **Send for approval** becomes available. Unsaved changes block sending and row pagination; switching tabs asks before discarding changes.
8. Choose **Send for approval**. Use **Entry history** to track saved, returned, waiting and published entries. Data-entry admins see their own history and cannot publish.
9. The main admin opens **Review & publish**, which contains only entries waiting for approval. Open an entry, inspect its source and changes, then **Approve & publish** or expand **Something needs changing?** and **Return for changes** with a note.

Original uploads and error downloads remain under **Source file & error report**. For duplicate/extra rows, fix the original spreadsheet and create a replacement draft rather than changing an identity to suppress an error. CSV row numbers refer to parsed row order; physical line numbers may differ when quoted values contain line breaks.

Submitted and published batches cannot be edited. A returned batch can be corrected, revalidated and resubmitted. A published batch stays as history; further changes need a new draft. Existing catalog rows have **Edit via draft**, which copies their current values into a private draft; verify/update the source before submitting.

The original source file, operator, timestamps, mapped values, corrections, before/after changes and publication record are retained. Batch history is paginated, with 25 rows per review page. Save row corrections before paging away. There is no automatic rollback button: use a reviewed correction batch. A database failure during publication rolls back the entire transaction, including its publication status and audit entry. If live data or linked masters changed after validation, publication is blocked; return and revalidate the batch.

### Format rules

- Maximum **2,000 data rows per worksheet**, **80 columns**, **20 worksheets per workbook**, **10 MB compressed file**, **32 MB expanded workbook**. Split larger sheets into batches. The 2,000-row path is exercised against an isolated replica set.
- First row: unique, non-empty headings. Remove merged headers, footers and formula cells; paste formulas as values. Hidden rows in the selected sheet are still data, so remove anything that should not be imported.
- Numbers: `100000`, not `1,00,000` or a currency symbol. Fees are INR. Normalize source fees to the website's annual tuition convention; do not mix annual fees with entire-course totals. `otherCharges` excludes hostel/mess; put those annual charges in `hostelMess` and preserve the source explanation in `sourceTag`. Hostel fees are shared by every course/tier of the same college and year: enter the same amount across those rows, or enter it once and leave the others blank. Conflicting amounts block the batch. For all three fee columns, a blank cell means N/A on a new entry and preserves the saved amount on an update. Enter `N/A` explicitly to mark an old amount unavailable; enter `0` only for confirmed zero charges. Tuition and hostel changes publish together in one transaction after review.
- Lists (`images`, `facilities`, `eligibility`, `careerPath`): separate values with `|`. Use the literal `[]` to intentionally clear a list. Blank optional values preserve existing fields. Blank is not a delete command.
- Booleans: `true` or `false`. Quota and round labels must match the sample/validation options exactly. Course slugs are lowercase; college codes are uppercase.
- **Cutoff and seat categories:** enter the exact category code from your official source, for example `DEF1`, `DEF2 W`, `EWS(W)`, `HOPEN`, `EMOBCW` or `NTB(W)`. The form suggests common and saved codes, but you can type any other source code (1–80 characters, single line). Excel accepts these same codes without adding them to a fixed list. Outer spaces are removed; internal spaces, brackets and case are preserved. `OBC`, `OBC(W)` and `OBC-NCL` remain separate categories. Use consistent source labels across your sheets; no category aliases are merged automatically. Published codes for active colleges appear in website filters; draft rows do not. Cutoff filters show cutoff categories, while college filters also include seat-matrix categories. After updating the application, revalidate any previously rejected category rows.
- Required college fields: collegeCode, name, city, state, ownership (`govt`, `private`, `deemed`). Optional `location` accepts `latitude=11.6500944|longitude=92.7493750` or JSON such as `{"lat":11.6500944,"lng":92.7493750}`. Latitude must be between -90 and 90, longitude between -180 and 180. Leave it blank when unknown.
- Optional columns do not erase existing values when omitted. Existing extra fields are retained. The importer does not delete records or merge colleges automatically.
- Admin table exports and directory exports cover the **current page**; use the dataset sample workbook as the import format.

## College images

Choose **Single record draft -> Colleges**, or create an existing college draft and open its row. Select a JPEG, PNG, WebP or GIF in the photo input. The backend uploads to Cloudinary and adds the HTTPS URL to that draft's images field. Select additional files one at a time. Maximum **8 MB per file / 20 images per college**.

The first URL is the cover. Reorder or remove URLs in the draft field to adjust the gallery; use `[]` to remove all images. Save corrections, validate, submit and publish. Uploading a photo alone does not attach it to a public college. Removing a URL does not delete the original Cloudinary asset; rejected/abandoned drafts may leave unused assets for later cleanup.

The backend requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. Secrets stay on the backend; an unsigned browser upload preset is unnecessary. The Site settings status checks configuration presence, not successful delivery.

## Other admin tabs and example values

Placeholders are examples, not prefilled production records. Use actual IDs copied from Users/Counsellors and real dates. Example placeholders are provided directly in the relevant admin forms.

| Tab | Example / meaning |
| --- | --- |
| Subscription plans | Name: Cutoff access; slug: cutoff-access; price: 99 INR; durationDays: 120; features: one per line. Set the intended duration explicitly. |
| Coupons | NEET10; percent; value 10; usageLimit 100; actual start/end timestamps. For flat coupons, value is INR. |
| Counselling services | College choice consultation; 30 minutes; 499 INR; accurate service description. |
| Counsellors | Existing user ID; Hindi and English on separate lines; session fee 499 INR; commissionRate 0.20 means 20%. |
| Availability slots | Existing counsellor ID and a future appointment time in the browser's local timezone. Only open slots can be edited. |
| Bookings | Real HTTPS meeting URL for a confirmed, paid booking. This screen cannot turn an unpaid booking into a paid one. |
| Users / Payments / Audit | These are operational records, not sheets to fill with sample transactions. Users register and payment records come from actual checkout events. |
| Site settings | Verified dashboard deadline, official source, enable/disable control; service configuration status; data-entry team access. The Help tab is removed. |

The paid cutoff tab remains subscription-gated. Current entitlement is any active, unexpired subscription; this release does not introduce a separate year-specific or plan-specific cutoff license. Admin/data-entry roles alone do not grant premium access on public routes. Plans must be configured with the intended actual price; the 99 placeholder does not create a plan or activate a subscription.

## Deployment and verification

These code changes were not deployed, and no demo batches were published to your configured live database. Before production traffic: run the additive import migration, restart services, configure real OTP delivery, use production settings and verify the deployed Razorpay checkout/webhook and an actual image upload. Do not interpret local tests as a verified live payment flow.

Previously inspected local configuration used development mode and mock email/phone OTP, with missing SMTP host/user/password. MongoDB, Redis and Cloudinary passed read-only connectivity checks earlier; the Redis URL was corrected to TLS (`rediss://`). Those checks do not prove current provider availability. Keep strong distinct JWT secrets, HTTPS origins and the deployed VITE_API_URL configured. Start the worker for subscription expiry and slot release.

```sh
# backend
npm test
npm run test:integration
npm run check:services

# frontend
npm run typecheck
npm run build
npm run test:e2e
```

Backend unit tests cover parser bounds, all eight sample workbooks, permissions and uploads. Integration tests start a temporary local MongoDB replica set (first run may download a MongoDB binary into `backend/.cache/mongodb`), testing atomic rollback, concurrent publishes, source aliases, 2,000-row batches and cutoff entitlement. They never connect to the application database. Browser tests use mocked API responses and do not send OTP, charge users or upload real Cloudinary files. `check:services` is a separate read-only provider ping using your configured environment.

## Single and bulk deletion

Main admin: open the relevant published-data tab (Colleges & photos, Courses, Course links, Fees, Service bonds, Seats or Cutoffs). The **Fees** table shows tuition, other charges and hostel/mess together. For shared hostel records (including earlier hostel-only uploads), expand **Manage saved college-wide hostel amounts** below the table. Deleting a tuition row preserves shared hostel fees; deleting a shared hostel record removes that amount for every course/tier of that college/year. Click **Delete** on one row, or tick rows / **Select all records on this page** and click **Delete selected**. Selection applies to the current page. Review the named records, enter a reason and confirm. The backend supports up to 100 explicit IDs per request.

A college cannot be deleted while course links or hostel fees remain. A course cannot be deleted while college-course links remain. A course link cannot be deleted while fees, cutoffs, seats or bonds reference it. The confirmation shows blocking sections and counts; delete the incorrect child records first. Deletion never silently removes academic child datasets. Deleting a college also removes its saved-college bookmarks and import aliases. Historical import batches remain for audit; an already-published batch does not republish itself.

Deletion is atomic, includes an audit copy of each record, checks for changes since the preview, and uses the same lock as publication. If anything changes or fails, the whole selection remains. Data-entry admins cannot delete published records. They can submit corrections through their drafts.

## A published cutoff is not visible

The cutoff explorer initially includes all categories, quotas and years, ordered by newest year and counselling round (Stray, Mop-up, Round 3, Round 2, Round 1). Narrow filters only after checking the full list. **Refresh cutoffs** reloads the published data. Public college cards show one latest cutoff preview with its course, category, quota, year and round; it is not a General-category prediction. The full cutoff table keeps the existing free-row limit and paid access checks.

Check **Entry history**: a saved or submitted draft is not live until **Approve & publish** succeeds. Also check that the linked college is visible on the website. For example, an OBC / State row is not expected to appear when filtering General / AIQ. Publishing invalidates the browser's route data. No need to re-enter an already-published cutoff.

Sample sheets: [Combined fees](samples/imports/fees-sample.xlsx) and [Service bonds](samples/imports/bonds-sample.xlsx), also downloadable directly from Data entry. The earlier [hostel-only workbook](samples/imports/hostel-fees-sample.xlsx) remains supported for existing drafts/API integrations; new entries use the combined Fees sheet. Run `npm run prepare:imports` once with this update to create the hostel/bond collections and required existing indexes before production imports. This does not add sample data.

## OTP and payment activation

Follow [deploy/OTP-PAYMENTS.md](deploy/OTP-PAYMENTS.md) after filling credentials. Email needs `EMAIL_OTP_PROVIDER=smtp`; phone needs MSG91 or Twilio Verify separately. Razorpay requires API keys, a matching webhook secret, the dashboard webhook, automatic capture and an active admin plan. Admin > Payments now shows activation status and review details. Treat `manual_review` as a paid booking needing an operator to arrange rebooking/refund; it does not reserve another student's slot.

## Unknown college-course intake

In **Data entry > College courses**, `totalSeats` accepts a positive whole number (for example `150`) or `N/A` when information is unavailable. Excel/CSV, manual entry and reviewed corrections support this. Keep this required cell explicit; a blank cell is not a substitute for `N/A`. Unknown intake is saved as null and displayed as N/A, not zero. An overall college total also stays N/A if any included course has unknown intake. Upload the actual number later using the same collegeCode + courseSlug to update the existing link; fees and cutoffs stay linked. The downloadable college-course workbook now includes this example and instructions. Seat-matrix counts retain their separate numeric validation.

### Unknown fees (N/A)

`tuition`, `otherCharges` and `hostelMess` accept numbers or `N/A` in Excel/CSV and manual entry. New blank amounts are unknown and display as N/A, never zero. Blank updates preserve existing values; explicit N/A changes the amount to unknown. Required college/course, year and tier references must still be filled. Unknown fees are excluded from fee ranges and budget filters. A later numeric upload with the same identifying fields updates the existing record.

### Unknown bond years and penalty (N/A)

In **Data entry > Service bonds**, `years` and `penaltyAmount` each accept a number or `N/A`. Blank values on new entries are saved as unknown; blanks on updates preserve the saved values. Explicit `N/A` marks an existing value unavailable. Enter `0` only for a confirmed zero service period or penalty. One field may be known while the other is N/A. College/course references remain required, and numeric years must stay between 0 and 50. The college page and comparison show N/A independently for each unknown field. The updated bonds sample workbook includes these instructions.
