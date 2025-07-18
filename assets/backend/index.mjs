import axios from "axios";

export const handler = async (event) => {
  try {
    const response = await axios.get("https://api.chucknorris.io/jokes/random");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Joke fetched successfully",
        joke: response.data.value,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to fetch joke",
        error: err.message,
      }),
    };
  }
};
