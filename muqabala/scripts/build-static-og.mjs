import sharp from 'sharp';
import {mkdir,stat} from 'node:fs/promises';
const cards=[
  {name:'schools',lines:['Interview practice for every student.','Evidence for every adviser.'],sub:'For careers advisers, tutors and teachers',path:'/schools'},
  {name:'employers',lines:['See who can do the job','before you open a CV.'],sub:'Muqabala for Hiring Teams',path:'/for-employers'},
  {name:'home',lines:['Private interview practice.','Clear feedback for your next answer.'],sub:'English or Arabic. Free, no account.',path:''},
];
await mkdir('public/og',{recursive:true});
for(const card of cards){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#F8F6EF"/>
    <g transform="translate(66 52) scale(.75)" fill="#163E39"><path d="M26 36 A27 27 0 1 0 70 36" fill="none" stroke="#163E39" stroke-width="11" stroke-linecap="round"/><circle cx="35" cy="17" r="7.5"/><circle cx="61" cy="17" r="7.5" fill="#B9892E"/></g>
    <g fill="#163E39" font-family="Arial, sans-serif"><text x="157" y="100" font-size="42" font-weight="700">Muqabala</text>
      <text x="70" y="270" font-size="51" font-weight="700">${card.lines[0]}</text><text x="70" y="342" font-size="51" font-weight="700">${card.lines[1]}</text>
      <text x="73" y="425" font-size="30">${card.sub}</text><text x="73" y="558" font-size="24">trymuqabala.com${card.path}</text>
      <text x="870" y="558" font-size="20">by Inspire Ambitions</text></g></svg>`;
  const path='public/og/'+card.name+'.png';await sharp(Buffer.from(svg)).png({palette:true,compressionLevel:9}).toFile(path);
  if((await stat(path)).size>=300000)throw new Error('Image exceeds the agreed size');
  console.log(path);
}
