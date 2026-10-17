import { render } from 'preact';
import './style.css';
import { init } from './store/store';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);
init();
