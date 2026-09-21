# Healthcare course master after Class 12

`medical-courses-after-12th.xlsx` contains 50 course pathways, reviewed on 13 September 2026, across medicine, dentistry, AYUSH, nursing, pharmacy, rehabilitation, allied health, health sciences and veterinary education.

It is an editorial course catalogue, not fabricated college data. It does not contain fees, seats, ranks, college affiliations or promises of professional registration. It covers common degrees, specialist allied-health pathways and selected state diplomas; it is not a claim that every regional award title is identical or exhaustively listed.

Read each row's `sourceUrls`, `admissionNotes` and `reviewedOn`. General duration labels deliberately allow for institution and curriculum differences. Recent NCAHP/UGC changes make the current admission-year prospectus especially important. Similar labels in `aliases` aid search, not automatic equivalence or college linking. A general psychology/life-science degree is not a clinical practice qualification. Post Basic B.Sc. Nursing, master's programmes and postgraduate Pharm.D are not direct Class 12 entry and are excluded.

Use the **Courses** worksheet in **Admin > Data entry > Courses**. Keep `slug` unchanged after publishing. In your college-course workbook, copy that value into `courseSlug`; for example, `COL-MH-001` plus `bsc-nursing` links that college to B.Sc. Nursing. Publish the college and course first, then their link, then verified fees/seats/cutoffs. Never place a nursing entrance rank in a NEET dataset merely because the course is now in this catalogue.

The source data lives in `backend/src/data/medicalCourses.js`. From `backend`:

```sh
npm run catalogue:courses -- --export-only
npm run catalogue:courses
npm run catalogue:courses -- --publish
```

The first command only regenerates this workbook. The second previews missing courses in the configured database. The third requires one active main administrator and initialized import storage; it creates a stored workbook draft, validates it and publishes through the existing transactional workflow with an audit record. Existing course IDs and content are preserved. Slug/name matches are skipped, and a concurrent conflicting change stops publication. A second successful run is a no-op. There is no startup seeding or automatic import on application boot.
