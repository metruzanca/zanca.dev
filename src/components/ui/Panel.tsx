import type { ParentComponent } from 'solid-js';

interface Props {
	class?: string;
}

const Panel: ParentComponent<Props> = (props) => {
	const classes = () => `rounded-xl border border-border bg-card p-6${props.class ? ' ' + props.class : ''}`;
	return <div class={classes()}>{props.children}</div>;
};

export default Panel;
