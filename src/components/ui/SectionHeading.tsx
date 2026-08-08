interface Props {
	id: string;
	eyebrow: string;
	title: string;
	description: string;
}

const SectionHeading = (props: Props) => {
	return (
		<div id={props.id} class="scroll-mt-20">
			<p class="font-mono text-xs uppercase tracking-[0.2em] text-accent">{props.eyebrow}</p>
			<h2 class="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-foreground md:text-3xl">
				{props.title}
			</h2>
			<p class="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{props.description}</p>
		</div>
	);
};

export default SectionHeading;
