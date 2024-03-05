/* --- built-in modules */
const fs = require("fs");
const readline = require("readline");

const axios = require("axios");

const PRIVATE_APP_ACCESS = "";
const domain_hubspot = "https://api.hubapi.com";

const delay_timer = (sec) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("Done!");
    }, sec * 1000);
  });
};

function getFormattedDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");

  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function get_time(hs_object_id) {
  let first_page_seen;

  // --- call API
  try {
    // --- Fill up optional properties
    const contactId = hs_object_id;
    const propertiesWithHistory = ["hs_analytics_first_url"];
    const archived = false;

    const headers = {
      Authorization: `Bearer ${PRIVATE_APP_ACCESS}`,
      "Content-Type": "application/json",
      accept: "application/json",
    };
    const property = {
      propertiesWithHistory: propertiesWithHistory,
      archived: archived,
    };
    const queryParams = new URLSearchParams(property).toString();
    const url = domain_hubspot + "/crm/v3/objects/contacts/" + contactId + "?" + queryParams;

    const apiResponse = await axios.get(url, { headers });

    first_page_seen = apiResponse.data.propertiesWithHistory.hs_analytics_first_url;
  } catch (e) {
    e.message === "HTTP request failed" ? console.error(JSON.stringify(e.response, null, 2)) : console.error(e);
  }

  // --- if there are any timestamp data
  if (first_page_seen.length > 0) {
    let date_seen = new Date(first_page_seen[0].timestamp);

    return date_seen;
  } else {
    return false;
  }
}

async function update_property(contact_id) {
  let updated_contact;

  // --- call API
  try {
    const url = domain_hubspot + "/crm/v3/objects/contacts/" + contact_id;
    const headers = {
      Authorization: `Bearer ${PRIVATE_APP_ACCESS}`,
      "Content-Type": "application/json",
      accept: "application/json",
    };
    // --- Fill up optional properties
    const body = JSON.stringify({
      properties: {
        create_date___first_page_seen_date_same: "Yes",
      },
    });

    const apiResponse = await axios.patch(url, body, { headers });

    updated_contact = apiResponse.data;
  } catch (e) {
    e.message === "HTTP request failed" ? console.error(JSON.stringify(e.response, null, 2)) : console.error(e);
  }

  return true;
}

async function batch_update_property(contacts) {
  let update_data = [];
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    const data = {
      id: contact.id,
      properties: {
        create_date___first_page_seen_date_same: "Yes",
      },
    };

    update_data.push(data);
  }
  //   console.log(update_data);

  let updated_contacts;
  // --- call API
  try {
    const url = domain_hubspot + "/crm/v3/objects/contacts/batch/update";
    const headers = {
      Authorization: `Bearer ${PRIVATE_APP_ACCESS}`,
      "Content-Type": "application/json",
      accept: "application/json",
    };
    // --- Fill up optional properties
    const body = JSON.stringify({
      inputs: update_data,
    });

    const apiResponse = await axios.post(url, body, { headers });

    updated_contacts = apiResponse.data;
  } catch (e) {
    e.message === "HTTP request failed" ? console.error(JSON.stringify(e.response, null, 2)) : console.error(e);
  }
  //   console.log(JSON.stringify(updated_contacts, null, 2));
  console.log(updated_contacts.status);

  return true;
}
// batch_update_property([{ id: 2801 }, { id: 3051 }]);

async function exported_contacts() {
  // Specify the path to your CSV file
  const filePath = "data/contactsNew.json";
  const rawData = fs.readFileSync(filePath, "utf8");

  // Parse the JSON content
  let jsonData = JSON.parse(rawData);

  let temp_batch = [];

  let count = 0;
  //   let count = 139263;
  //   jsonData = jsonData.slice(count);
  for await (const data of jsonData) {
    count += 1;
    console.log("=========");
    console.log(`(${count}) - Id: ${data.id}`);

    const contactID = data.id;
    const createdate = new Date(data.properties.createdate);

    // const date_seen = await get_time(contactID); // ---> import data has it alread
    let date_seen = data.propertiesWithHistory.hs_analytics_first_url;

    // --- if no date_seen data is available, then stop
    if (date_seen.length == 0) {
      continue;
    }
    date_seen = new Date(date_seen[0].timestamp);

    // console.log("createdate = " + createdate);
    // console.log("date_seen = " + date_seen);

    let temp_createdate = getFormattedDate(createdate);
    let temp_date_seen = getFormattedDate(date_seen);

    // // --- Update one by one
    // if (temp_createdate == temp_date_seen) {
    //   const update = await update_property(contactID);
    //   console.log("+++++++ Updated +++++++");
    //   await delay_timer(0.05);
    // } else {
    //   console.log("Not same");
    // }

    // --- Update by batch
    if (temp_batch.length < 50) {
      if (temp_createdate == temp_date_seen) {
        temp_batch.push({ id: contactID });
        console.log("+++++++ Updated +++++++");
      } else {
        console.log("Not same");
      }
    } else {
      console.log(temp_batch);
      const batch_update = await batch_update_property(temp_batch);
      temp_batch = [];
      await delay_timer(1);
    }

    // await delay_timer(0.1);
  }

  return true;
}
exported_contacts();
