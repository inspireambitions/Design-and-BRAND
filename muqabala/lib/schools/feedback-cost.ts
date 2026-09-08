// Configure rates only after the founder verifies the chosen model's price.
export function schoolsFeedbackCost(input:number|undefined,output:number|undefined,inputRate=process.env.SCHOOLS_INPUT_USD_PER_MILLION,outputRate=process.env.SCHOOLS_OUTPUT_USD_PER_MILLION):number|null {
  if(input===undefined||output===undefined||!inputRate?.trim()||!outputRate?.trim())return null;
  const a=Number(inputRate),b=Number(outputRate);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0||input<0||output<0)return null;
  return (input*a+output*b)/1000000;
}
