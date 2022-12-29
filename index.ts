import axios from 'axios';
import {parse} from 'json2csv';
import {JSDOM} from 'jsdom';
import fs  from 'fs';

import { format } from 'date-fns'

type dadosMare = {
  date: string;
  hour: string;
  height: number;
}

function dataExtration(htmlText: string, monthYear: string[]) {
  const dom = new JSDOM(htmlText);
  const domDocument = dom.window.document;

  const monthData:dadosMare[] = [];
  
  const liDados = domDocument.querySelectorAll(`li.dados`);
  liDados.forEach(element => {
    const dia = element.querySelector('strong')?.textContent
    if (dia) {
      const day = dia.split('/')[0];
      const liDadosText = element.innerHTML;
      
      const regex = /<br>([^<]+)/g;
      let match;

      while ((match = regex.exec(liDadosText)) !== null) {

        const hourlyData = hourDataExtration(match[1])

        monthData.push({
          date: `${day}/${monthYear[0]}/${monthYear[1]}`,
          hour: `${hourlyData?.hour}:${hourlyData?.minute}`,
          height: Number(hourlyData?.height)
        });
      }
    }
  });

  return monthData;
}

function hourDataExtration(line: string) {
  const regex = /(\d{2}):(\d{2})\s+&nbsp;\s+(\d\.\d+)/;
  const match = line.match(regex);

  if (match) {
    const hour = match[1];
    const minute = match[2];
    const number = match[3];
    return {
      hour,
      minute,
      height: number
    }
  }
}

async function getMonthSeaLevelData({station, monthYearArr}: {station: string, monthYearArr: string[]}): Promise<dadosMare[]>{

  const urlString = `http://ondas.cptec.inpe.br/~rondas/mares/index.php?cod=${station}&mes=${monthYearArr[0]}&ano=${monthYearArr[1]}`

  console.log(urlString);
  try {
    const response = await axios.get(urlString);
    const dataExtrationResults = dataExtration(response.data, monthYearArr);
    return dataExtrationResults
  } catch (error) {
    console.error(error);
  }

  return []
}

async function getMonthlySeaLevel(startDate: Date, endDate: Date): Promise<dadosMare[]> {
  const seaLevelCompleteData: dadosMare[] = [];

  let currDate = startDate;

  while (startDate < endDate) {

    const monthYearArr = format(currDate, 'MM/yy').split('/');

    const crrMonthData = await getMonthSeaLevelData({station: '10520', monthYearArr})

    seaLevelCompleteData.push(...crrMonthData)

    currDate.setMonth(currDate.getMonth() + 1)
  }


  return seaLevelCompleteData
}

// Febuary is 1
const startDate = new Date(2006, 0, 1);
const endDate = new Date(2022, 11, 1);

console.log(startDate);

getMonthlySeaLevel(startDate, endDate).then((seaLevelData) => {
  const fields = ['date', 'hour', 'height'];
  const opts = { fields };
  
  try {
    const csv = parse(seaLevelData, opts);
    fs.writeFile('tables/table.csv', csv, 'utf8', function (err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } else{
        console.log('It\'s saved!');
      }
    });
  } catch (err) {
    console.error(err);
  }
})


