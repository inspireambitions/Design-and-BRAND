import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentRosterCsv } from '../lib/schools/roster-import.ts';

test('parses standard CSV with headers', () => {
  const csv = `student_id,name,email
STU001,Sara Al-Hashimi,sara@uni.ac.ae
STU002,Omar Khalid,omar@uni.ac.ae
STU003,Fatima Zahra,fatima@uni.ac.ae`;

  const result = parseStudentRosterCsv(csv);
  assert.equal(result.total, 3);
  assert.equal(result.valid.length, 3);
  assert.equal(result.duplicates.length, 0);
  assert.equal(result.invalid.length, 0);

  assert.deepEqual(result.valid[0], {
    studentIdentifier: 'STU001',
    name: 'Sara Al-Hashimi',
    email: 'sara@uni.ac.ae',
  });
});

test('parses Arabic student names and Arabic headers', () => {
  const csv = `الرقم الجامعي,الاسم,البريد الإلكتروني
20240101,أحمد محمد المنصوري,ahmed@kfupm.edu.sa
20240102,مريم عبد الله الشامسي,maryam@kfupm.edu.sa`;

  const result = parseStudentRosterCsv(csv);
  assert.equal(result.total, 2);
  assert.equal(result.valid.length, 2);
  assert.equal(result.valid[0].name, 'أحمد محمد المنصوري');
  assert.equal(result.valid[0].studentIdentifier, '20240101');
  assert.equal(result.valid[0].email, 'ahmed@kfupm.edu.sa');
  assert.equal(result.valid[1].name, 'مريم عبد الله الشامسي');
});

test('handles UTF-8 with BOM and quoted fields with commas', () => {
  const bom = '\uFEFF';
  const csv = `${bom}student_id,name,email
"U-9901","Al-Naimi, Tariq",tariq@aus.edu
"U-9902","Zayed, Layla",layla@aus.edu`;

  const result = parseStudentRosterCsv(csv);
  assert.equal(result.valid.length, 2);
  assert.equal(result.valid[0].name, 'Al-Naimi, Tariq');
  assert.equal(result.valid[0].studentIdentifier, 'U-9901');
});

test('handles semicolon and tab delimiters', () => {
  const semicolonCsv = `student_id;name;email
1001;Zaid Ammar;zaid@college.edu`;
  const tabCsv = `student_id\tname\temail
1002\tHana Youssef\thana@college.edu`;

  const resSemi = parseStudentRosterCsv(semicolonCsv);
  assert.equal(resSemi.valid.length, 1);
  assert.equal(resSemi.valid[0].name, 'Zaid Ammar');

  const resTab = parseStudentRosterCsv(tabCsv);
  assert.equal(resTab.valid.length, 1);
  assert.equal(resTab.valid[0].name, 'Hana Youssef');
});

test('detects duplicate student identifiers and emails', () => {
  const csv = `student_id,name,email
S101,Khalid Ali,khalid@test.edu
S102,Rashid Noor,rashid@test.edu
S101,Duplicate ID Student,diff@test.edu
S103,Duplicate Email,khalid@test.edu`;

  const result = parseStudentRosterCsv(csv);
  assert.equal(result.valid.length, 2);
  assert.equal(result.duplicates.length, 2);
  assert.equal(result.duplicates[0].studentIdentifier, 'S101');
  assert.equal(result.duplicates[1].email, 'khalid@test.edu');
});

test('detects malformed rows with missing names or invalid emails', () => {
  const csv = `student_id,name,email
S001,Good Student,good@test.edu
S002,,missing_name@test.edu
S003,Bad Email Student,not-an-email`;

  const result = parseStudentRosterCsv(csv);
  assert.equal(result.valid.length, 1);
  assert.equal(result.invalid.length, 2);
  assert.match(result.invalid[0].error, /name is required/i);
  assert.match(result.invalid[1].error, /Invalid email address format/i);
});

test('handles empty or blank CSV safely', () => {
  const empty = parseStudentRosterCsv('');
  assert.equal(empty.total, 0);
  assert.equal(empty.valid.length, 0);

  const spaces = parseStudentRosterCsv('   \n  \n  ');
  assert.equal(spaces.total, 0);
  assert.equal(spaces.valid.length, 0);
});
