import { render } from "solid-js/web";
import Finder from "../../components/Finder";
import "../../components/finder.css";
import "./style.css";
const root = document.getElementById("root");
if (root) render(() => <Finder close={() => window.close()} />, root);
