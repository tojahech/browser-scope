import { render } from "solid-js/web";
import App from "./app";
import "./options.css";

const root = document.getElementById("root");

if (root === null) {
	throw new Error("Root element not found");
}

render(() => <App />, root);
