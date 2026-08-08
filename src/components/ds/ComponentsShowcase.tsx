import { createSignal, For } from 'solid-js';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import Input from '../ui/Input';
import Toggle from '../ui/Toggle';
import SectionHeading from '../ui/SectionHeading';
import { ArrowRight, Heart, Play, Plus, Zap } from '../ui/icons/icons';

const BADGES: [string, string][] = [
	['Online', 'border-accent/40 bg-accent/10 text-accent'],
	['New', 'border-primary/40 bg-primary/10 text-primary'],
	['Beta', 'border-neon-purple/40 bg-neon-purple/10 text-neon-purple'],
	['Pro', 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber'],
	['Offline', 'border-border bg-muted text-muted-foreground'],
];

const DsComponentsShowcase = () => {
	const [callsign, setCallsign] = createSignal('');
	const [frequency, setFrequency] = createSignal('');
	const [toggled, setToggled] = createSignal(true);

	return (
		<div class="flex flex-col gap-16 px-4 py-12 md:px-8">
			<section class="flex flex-col gap-6">
				<SectionHeading
					id="buttons"
					eyebrow="Components"
					title="Buttons"
					description="Action triggers across variants and sizes. The primary button carries the signature neon glow."
				/>
				<Panel>
					<div class="flex flex-col gap-6">
						<div class="flex flex-wrap items-center gap-3">
							<Button variant="default" class="shadow-glow-pink">
								<Zap class="size-4" />
								Primary
							</Button>
							<Button variant="secondary">Secondary</Button>
							<Button variant="outline">Outline</Button>
							<Button variant="ghost">Ghost</Button>
							<Button variant="destructive">Destructive</Button>
							<Button variant="link">
								Link
								<ArrowRight class="size-4" />
							</Button>
						</div>
						<div class="flex flex-wrap items-center gap-3">
							<Button size="sm">Small</Button>
							<Button size="default">Default</Button>
							<Button size="lg">Large</Button>
							<Button size="icon" ariaLabel="Add">
								<Plus class="size-4" />
							</Button>
							<Button variant="outline" size="icon" ariaLabel="Play">
								<Play class="size-4" />
							</Button>
						</div>
					</div>
				</Panel>
			</section>

			<section class="flex flex-col gap-6">
				<SectionHeading
					id="badges"
					eyebrow="Components"
					title="Badges"
					description="Compact status indicators with subtle neon tints for quick scanning."
				/>
				<Panel>
					<div class="flex flex-wrap gap-3">
						<For each={BADGES}>
							{([label, variantClasses]) => (
								<span class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-widest ${variantClasses}`}>
									<span class="size-1.5 rounded-full bg-current"></span>
									{label}
								</span>
							)}
						</For>
					</div>
				</Panel>
			</section>

			<section class="flex flex-col gap-6">
				<SectionHeading
					id="inputs"
					eyebrow="Components"
					title="Inputs & Controls"
					description="Form fields glow on focus, switches snap with neon feedback."
				/>
				<Panel>
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<Input id="callsign" label="Callsign" value={callsign()} onInput={setCallsign} glow="pink" placeholder="Enter your handle" />
						<Input id="freq" label="Frequency" value={frequency()} onInput={setFrequency} glow="cyan" placeholder="88.5 FM" />
						<div class="flex items-center justify-between gap-4 md:col-span-2">
							<div>
								<p class="text-sm font-medium text-foreground">Neon Mode</p>
								<p class="text-xs text-muted-foreground">Crank the glow to maximum.</p>
							</div>
							<Toggle checked={toggled()} onToggle={() => setToggled((t) => !t)} />
						</div>
					</div>
				</Panel>
			</section>

			<section class="flex flex-col gap-6">
				<SectionHeading
					id="cards"
					eyebrow="Components"
					title="Cards"
					description="Composable surfaces for grouping content, stats, and calls to action."
				/>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50">
						<Heart class="size-5 text-primary" />
						<p class="mt-4 font-display text-lg font-bold uppercase text-foreground">Track 01</p>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">Midnight cruise through endless neon boulevards.</p>
						<Button variant="outline" size="sm" class="mt-4">
							<Play class="size-4" />
							Play
						</Button>
					</div>

					<div class="rounded-xl border border-primary/40 bg-card p-6 shadow-glow-pink">
						<span class="font-mono text-xs uppercase tracking-widest text-primary">Featured</span>
						<p class="mt-3 font-display text-3xl font-extrabold text-foreground">
							88
							<span class="ml-1 text-base font-normal text-muted-foreground">bpm</span>
						</p>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">The exact tempo of the future.</p>
						<Button variant="default" class="mt-4 w-full shadow-glow-pink">
							Subscribe
						</Button>
					</div>

					<div class="synth-grid relative overflow-hidden rounded-xl border border-border bg-card p-6">
						<div class="relative">
							<Zap class="size-5 text-accent" />
							<p class="mt-4 font-display text-lg font-bold uppercase text-foreground">Boost</p>
							<p class="mt-1 text-sm leading-relaxed text-muted-foreground">Overclock your interface with pure voltage.</p>
							<Button variant="secondary" size="sm" class="mt-4">
								Activate
							</Button>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
};

export default DsComponentsShowcase;
