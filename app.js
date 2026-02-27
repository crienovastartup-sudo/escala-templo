const API_URL = "https://script.google.com/macros/s/AKfycbxlue6Nx3_6kmhxjNtbFfdfSULR_SBwgVVi3zQ-8rhGdPuXaJd_i276Ed_OMBj4MJ1QnQ/exec";

async function api(data) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}
