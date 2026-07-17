import { render } from "solid-js/web";
import App from "./app";
import "./style.css";

const root = document.getElementById("root");

if (!root) throw new Error("Options root element not found");

render(() => <App />, root);
