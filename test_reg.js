const body = {
  email: "test2@jobwahala.com",
  password: "password123",
  role: "SEEKER"
};

fetch("https://jobwahala-production.up.railway.app/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
})
  .then(async (res) => {
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  })
  .catch(console.error);
