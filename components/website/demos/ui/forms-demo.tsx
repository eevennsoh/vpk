"use client";

import { useForm } from "@tanstack/react-form";
import { XIcon } from "@/components/ui/vpk-icons";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
} from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SonnerToast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function showSubmittedValuesToast(value: unknown) {
	toast.custom(
		(id) => (
			<SonnerToast
				appearance="info"
				title="You submitted the following values:"
				dismissible
				onDismiss={() => toast.dismiss(id)}
				description={
					<pre className="bg-bg-neutral text-text w-[320px] overflow-x-auto rounded-md p-4">
						<code>{JSON.stringify(value, null, 2)}</code>
					</pre>
				}
			/>
		),
		{
			position: "bottom-right",
		}
	);
}

const bugReportFormSchema = z.object({
	title: z
		.string()
		.min(5, "Bug title must be at least 5 characters.")
		.max(32, "Bug title must be at most 32 characters."),
	description: z
		.string()
		.min(20, "Description must be at least 20 characters.")
		.max(100, "Description must be at most 100 characters."),
});

const inputFormSchema = z.object({
	username: z
		.string()
		.min(3, "Username must be at least 3 characters.")
		.max(10, "Username must be at most 10 characters.")
		.regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
});

const textareaFormSchema = z.object({
	about: z
		.string()
		.min(10, "Please provide at least 10 characters.")
		.max(200, "Please keep it under 200 characters."),
});

const spokenLanguages = [
	{ label: "English", value: "en" },
	{ label: "Spanish", value: "es" },
	{ label: "French", value: "fr" },
	{ label: "German", value: "de" },
	{ label: "Italian", value: "it" },
	{ label: "Chinese", value: "zh" },
	{ label: "Japanese", value: "ja" },
] as const;

const selectFormSchema = z.object({
	language: z
		.string()
		.min(1, "Please select your spoken language.")
		.refine((value) => value !== "auto", {
			message: "Auto-detection is not allowed. Please select a specific language.",
		}),
});

const checkboxTasks = [
	{ id: "push", label: "Push notifications" },
	{ id: "email", label: "Email notifications" },
] as const;

const checkboxFormSchema = z.object({
	responses: z.boolean(),
	tasks: z
		.array(z.string())
		.min(1, "Please select at least one notification type.")
		.refine((value) => value.every((task) => checkboxTasks.some((candidate) => candidate.id === task)), {
			message: "Invalid notification type selected.",
		}),
});

const radioPlans = [
	{
		id: "starter",
		title: "Starter (100K tokens/month)",
		description: "For everyday use with basic features.",
	},
	{
		id: "pro",
		title: "Pro (1M tokens/month)",
		description: "For advanced AI usage with more features.",
	},
	{
		id: "enterprise",
		title: "Enterprise (Unlimited tokens)",
		description: "For large teams and heavy usage.",
	},
] as const;

const radioGroupFormSchema = z.object({
	plan: z.string().min(1, "You must select a subscription plan to continue."),
});

const switchFormSchema = z.object({
	twoFactor: z.boolean().refine((value) => value === true, {
		message: "It is highly recommended to enable two-factor authentication.",
	}),
});

const subscriptionAddons = [
	{
		id: "analytics",
		title: "Analytics",
		description: "Advanced analytics and reporting",
	},
	{
		id: "backup",
		title: "Backup",
		description: "Automated daily backups",
	},
	{
		id: "support",
		title: "Priority Support",
		description: "24/7 premium customer support",
	},
] as const;

const complexFormSchema = z.object({
	plan: z
		.string()
		.min(1, "Please select a subscription plan")
		.refine((value) => value === "basic" || value === "pro", {
			message: "Invalid plan selection. Please choose Basic or Pro",
		}),
	billingPeriod: z.string().min(1, "Please select a billing period"),
	addons: z
		.array(z.string())
		.min(1, "Please select at least one add-on")
		.max(3, "You can select up to 3 add-ons")
		.refine((value) => value.every((addon) => subscriptionAddons.some((candidate) => candidate.id === addon)), {
			message: "You selected an invalid add-on",
		}),
	emailNotifications: z.boolean(),
});

const arrayFormSchema = z.object({
	emails: z
		.array(
			z.object({
				address: z.email("Enter a valid email address."),
			})
		)
		.min(1, "Add at least one email address.")
		.max(5, "You can add up to 5 email addresses."),
});

const adsBasicFormSchema = z.object({
	username: z.string().min(3, "Username must be at least 3 characters."),
	email: z.email("Please enter a valid email address."),
	terms: z.boolean().refine((value) => value, {
		message: "You must accept the terms to continue.",
	}),
});

const adsValidationFormSchema = z.object({
	username: z
		.string()
		.min(3, "Username must be at least 3 characters.")
		.max(20, "Username must be 20 characters or less."),
});

export default function FormsDemo() {
	return <FormDemoTanstackBasic />;
}

export function FormDemoTanstackBasic() {
	const form = useForm({
		defaultValues: {
			title: "",
			description: "",
		},
		validators: {
			onSubmit: bugReportFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Bug Report</CardTitle>
				<CardDescription>Help us improve by reporting bugs you encounter.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-demo"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="title">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Bug title</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											placeholder="Login button not working on mobile"
											autoComplete="off"
										/>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="description">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Description</FieldLabel>
										<InputGroup>
											<InputGroupTextarea
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												placeholder="I'm having an issue with the login button on mobile."
												rows={6}
												className="min-h-24 resize-none"
												aria-invalid={isInvalid}
											/>
											<InputGroupAddon align="block-end">
												<InputGroupText className="tabular-nums">
													{field.state.value.length}/100 characters
												</InputGroupText>
											</InputGroupAddon>
										</InputGroup>
										<FieldDescription>
											Include steps to reproduce, expected behavior, and what actually happened.
										</FieldDescription>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-demo">
						Submit
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackInput() {
	const form = useForm({
		defaultValues: {
			username: "",
		},
		validators: {
			onSubmit: inputFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Profile Settings</CardTitle>
				<CardDescription>Update your profile information below.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-input"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="username">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="form-tanstack-input-username">Username</FieldLabel>
										<Input
											id="form-tanstack-input-username"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											placeholder="shadcn"
											autoComplete="username"
										/>
										<FieldDescription>
											This is your public display name. Must be between 3 and 10 characters. Must only contain
											letters, numbers, and underscores.
										</FieldDescription>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-input">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackTextarea() {
	const form = useForm({
		defaultValues: {
			about: "",
		},
		validators: {
			onSubmit: textareaFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Personalization</CardTitle>
				<CardDescription>Customize your experience by telling us more about yourself.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-textarea"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="about">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="form-tanstack-textarea-about">More about you</FieldLabel>
										<Textarea
											id="form-tanstack-textarea-about"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											placeholder="I'm a software engineer..."
											className="min-h-[120px]"
										/>
										<FieldDescription>
											Tell us more about yourself. This will be used to help us personalize your experience.
										</FieldDescription>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-textarea">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackSelect() {
	const form = useForm({
		defaultValues: {
			language: "",
		},
		validators: {
			onSubmit: selectFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[32rem] max-w-full">
			<CardHeader>
				<CardTitle>Language Preferences</CardTitle>
				<CardDescription>Select your preferred spoken language.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-select"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="language">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field orientation="responsive" data-invalid={isInvalid}>
										<FieldContent>
											<FieldLabel htmlFor="form-tanstack-select-language">Spoken language</FieldLabel>
											<FieldDescription>
												For best results, select the language you speak.
											</FieldDescription>
											{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
										</FieldContent>
										<Select
											name={field.name}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value ?? "")}
										>
											<SelectTrigger
												id="form-tanstack-select-language"
												aria-invalid={isInvalid}
												className="min-w-[120px]"
											>
												<SelectValue placeholder="Select" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="auto">Auto</SelectItem>
												<SelectSeparator />
												{spokenLanguages.map((language) => (
													<SelectItem key={language.value} value={language.value}>
														{language.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-select">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackCheckbox() {
	const form = useForm({
		defaultValues: {
			responses: true,
			tasks: [] as string[],
		},
		validators: {
			onSubmit: checkboxFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Notifications</CardTitle>
				<CardDescription>Manage your notification preferences.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-checkbox"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="responses">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<FieldSet>
										<FieldLegend variant="label">Responses</FieldLegend>
										<FieldDescription>
											Get notified for requests that take time, like research or image generation.
										</FieldDescription>
										<FieldGroup data-slot="checkbox-group">
											<Field orientation="horizontal" data-invalid={isInvalid}>
												<Checkbox
													id="form-tanstack-checkbox-responses"
													name={field.name}
													checked={field.state.value}
													onCheckedChange={(checked) => field.handleChange(checked === true)}
													disabled
												/>
												<FieldLabel htmlFor="form-tanstack-checkbox-responses" className="font-normal">
													Push notifications
												</FieldLabel>
											</Field>
										</FieldGroup>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</FieldSet>
								);
							}}
						</form.Field>
						<FieldSeparator />
						<form.Field name="tasks" mode="array">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<FieldSet>
										<FieldLegend variant="label">Tasks</FieldLegend>
										<FieldDescription>
											Get notified when tasks you&apos;ve created have updates.
										</FieldDescription>
										<FieldGroup data-slot="checkbox-group">
											{checkboxTasks.map((task) => (
												<Field key={task.id} orientation="horizontal" data-invalid={isInvalid}>
													<Checkbox
														id={`form-tanstack-checkbox-${task.id}`}
														name={field.name}
														aria-invalid={isInvalid}
														checked={field.state.value.includes(task.id)}
														onCheckedChange={(checked) => {
															if (checked) {
																field.pushValue(task.id);
																return;
															}

															const index = field.state.value.indexOf(task.id);
															if (index > -1) {
																field.removeValue(index);
															}
														}}
													/>
													<FieldLabel htmlFor={`form-tanstack-checkbox-${task.id}`} className="font-normal">
														{task.label}
													</FieldLabel>
												</Field>
											))}
										</FieldGroup>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</FieldSet>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-checkbox">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackRadioGroup() {
	const form = useForm({
		defaultValues: {
			plan: "",
		},
		validators: {
			onSubmit: radioGroupFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Subscription Plan</CardTitle>
				<CardDescription>See pricing and features for each plan.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-radiogroup"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="plan">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<FieldSet>
										<FieldLegend>Plan</FieldLegend>
										<FieldDescription>
											You can upgrade or downgrade your plan at any time.
										</FieldDescription>
										<RadioGroup name={field.name} value={field.state.value} onValueChange={field.handleChange}>
											{radioPlans.map((plan) => (
												<FieldLabel key={plan.id} htmlFor={`form-tanstack-radiogroup-${plan.id}`}>
													<Field orientation="horizontal" data-invalid={isInvalid}>
														<FieldContent>
															<FieldTitle>{plan.title}</FieldTitle>
															<FieldDescription>{plan.description}</FieldDescription>
														</FieldContent>
														<RadioGroupItem
															value={plan.id}
															id={`form-tanstack-radiogroup-${plan.id}`}
															aria-invalid={isInvalid}
														/>
													</Field>
												</FieldLabel>
											))}
										</RadioGroup>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</FieldSet>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-radiogroup">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackSwitch() {
	const form = useForm({
		defaultValues: {
			twoFactor: false,
		},
		validators: {
			onSubmit: switchFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Security Settings</CardTitle>
				<CardDescription>Manage your account security preferences.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-switch"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="twoFactor">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field orientation="horizontal" data-invalid={isInvalid}>
										<FieldContent>
											<FieldLabel htmlFor="form-tanstack-switch-two-factor">
												Multi-factor authentication
											</FieldLabel>
											<FieldDescription>
												Enable multi-factor authentication to secure your account.
											</FieldDescription>
											{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
										</FieldContent>
										<Switch
											id="form-tanstack-switch-two-factor"
											name={field.name}
											checked={field.state.value}
											onCheckedChange={field.handleChange}
											aria-invalid={isInvalid}
										/>
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-switch">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackComplex() {
	const form = useForm({
		defaultValues: {
			plan: "basic",
			billingPeriod: "monthly",
			addons: [] as string[],
			emailNotifications: false,
		},
		validators: {
			onSubmit: complexFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[24rem] max-w-full">
			<CardContent>
				<form
					id="form-tanstack-complex"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="plan">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<FieldSet>
										<FieldLegend>Subscription Plan</FieldLegend>
										<FieldDescription>Choose your subscription plan.</FieldDescription>
										<RadioGroup name={field.name} value={field.state.value} onValueChange={field.handleChange}>
											<FieldLabel htmlFor="form-tanstack-complex-basic">
												<Field orientation="horizontal" data-invalid={isInvalid}>
													<FieldContent>
														<FieldTitle>Basic</FieldTitle>
														<FieldDescription>For individuals and small teams</FieldDescription>
													</FieldContent>
													<RadioGroupItem
														value="basic"
														id="form-tanstack-complex-basic"
														aria-invalid={isInvalid}
													/>
												</Field>
											</FieldLabel>
											<FieldLabel htmlFor="form-tanstack-complex-pro">
												<Field orientation="horizontal" data-invalid={isInvalid}>
													<FieldContent>
														<FieldTitle>Pro</FieldTitle>
														<FieldDescription>For businesses with higher demands</FieldDescription>
													</FieldContent>
													<RadioGroupItem
														value="pro"
														id="form-tanstack-complex-pro"
														aria-invalid={isInvalid}
													/>
												</Field>
											</FieldLabel>
										</RadioGroup>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</FieldSet>
								);
							}}
						</form.Field>
						<FieldSeparator />
						<form.Field name="billingPeriod">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="form-tanstack-complex-billing-period">Billing period</FieldLabel>
										<Select
											name={field.name}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value ?? "")}
											aria-invalid={isInvalid}
										>
											<SelectTrigger id="form-tanstack-complex-billing-period">
												<SelectValue placeholder="Select" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="monthly">Monthly</SelectItem>
												<SelectItem value="yearly">Yearly</SelectItem>
											</SelectContent>
										</Select>
										<FieldDescription>Choose how often you want to be billed.</FieldDescription>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
						<FieldSeparator />
						<form.Field name="addons" mode="array">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<FieldSet>
										<FieldLegend>Add-ons</FieldLegend>
										<FieldDescription>
											Select additional features you&apos;d like to include.
										</FieldDescription>
										<FieldGroup data-slot="checkbox-group">
											{subscriptionAddons.map((addon) => (
												<Field key={addon.id} orientation="horizontal" data-invalid={isInvalid}>
													<Checkbox
														id={`form-tanstack-complex-${addon.id}`}
														name={field.name}
														aria-invalid={isInvalid}
														checked={field.state.value.includes(addon.id)}
														onCheckedChange={(checked) => {
															if (checked) {
																field.pushValue(addon.id);
																return;
															}

															const index = field.state.value.indexOf(addon.id);
															if (index > -1) {
																field.removeValue(index);
															}
														}}
													/>
													<FieldContent>
														<FieldLabel htmlFor={`form-tanstack-complex-${addon.id}`}>{addon.title}</FieldLabel>
														<FieldDescription>{addon.description}</FieldDescription>
													</FieldContent>
												</Field>
											))}
										</FieldGroup>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</FieldSet>
								);
							}}
						</form.Field>
						<FieldSeparator />
						<form.Field name="emailNotifications">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

								return (
									<Field orientation="horizontal" data-invalid={isInvalid}>
										<FieldContent>
											<FieldLabel htmlFor="form-tanstack-complex-email-notifications">
												Email notifications
											</FieldLabel>
											<FieldDescription>
												Receive email updates about your subscription.
											</FieldDescription>
										</FieldContent>
										<Switch
											id="form-tanstack-complex-email-notifications"
											name={field.name}
											checked={field.state.value}
											onCheckedChange={field.handleChange}
											aria-invalid={isInvalid}
										/>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal" className="justify-end">
					<Button type="submit" form="form-tanstack-complex">
						Save Preferences
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoTanstackArray() {
	const form = useForm({
		defaultValues: {
			emails: [{ address: "" }],
		},
		validators: {
			onBlur: arrayFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader className="border-b">
				<CardTitle>Contact Emails</CardTitle>
				<CardDescription>Manage your contact email addresses.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-tanstack-array"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="emails" mode="array">
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

							return (
								<FieldSet className="gap-4">
									<FieldLegend variant="label">Email addresses</FieldLegend>
									<FieldDescription>
										Add up to 5 email addresses where we can contact you.
									</FieldDescription>
									<FieldGroup className="gap-4">
										{field.state.value.map((_, index) => (
											<form.Field key={index} name={`emails[${index}].address`}>
												{(subField) => {
													const isSubFieldInvalid =
														subField.state.meta.isTouched && !subField.state.meta.isValid;

													return (
														<Field orientation="horizontal" data-invalid={isSubFieldInvalid}>
															<FieldContent>
																<InputGroup>
																	<InputGroupInput
																		id={`form-tanstack-array-email-${index}`}
																		name={subField.name}
																		value={subField.state.value}
																		onBlur={subField.handleBlur}
																		onChange={(event) => subField.handleChange(event.target.value)}
																		aria-invalid={isSubFieldInvalid}
																		placeholder="name@example.com"
																		type="email"
																		autoComplete="email"
																	/>
																	{field.state.value.length > 1 ? (
																		<InputGroupAddon align="inline-end">
																			<InputGroupButton
																				type="button"
																				variant="ghost"
																				size="icon-xs"
																				onClick={() => field.removeValue(index)}
																				aria-label={`Remove email ${index + 1}`}
																			>
																				<XIcon />
																			</InputGroupButton>
																		</InputGroupAddon>
																	) : null}
																</InputGroup>
																{isSubFieldInvalid ? <FieldError errors={subField.state.meta.errors} /> : null}
															</FieldContent>
														</Field>
													);
												}}
											</form.Field>
										))}
										<Button
											type="button"
											variant="outline"
											size="default"
											onClick={() => field.pushValue({ address: "" })}
											disabled={field.state.value.length >= 5}
										>
											Add Email Address
										</Button>
									</FieldGroup>
									{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
								</FieldSet>
							);
						}}
					</form.Field>
				</form>
			</CardContent>
			<CardFooter className="border-t">
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-tanstack-array">
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoAdsBasicForm() {
	const form = useForm({
		defaultValues: {
			username: "",
			email: "",
			terms: false,
		},
		validators: {
			onSubmit: adsBasicFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Basic Form</CardTitle>
				<CardDescription>Fill out the form below.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-ads-basic"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="username">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="form-ads-basic-username">Username</FieldLabel>
										<Input
											id="form-ads-basic-username"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											placeholder="jdoe"
											autoComplete="username"
										/>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="email">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="form-ads-basic-email">Email</FieldLabel>
										<Input
											id="form-ads-basic-email"
											type="email"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											placeholder="name@example.com"
											autoComplete="email"
										/>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
						<form.Field name="terms">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<FieldSet>
										<FieldGroup data-slot="checkbox-group">
											<Field orientation="horizontal" data-invalid={isInvalid}>
												<Checkbox
													id="form-ads-basic-terms"
													name={field.name}
													checked={field.state.value}
													onCheckedChange={(checked) => field.handleChange(checked === true)}
													aria-invalid={isInvalid}
												/>
												<FieldLabel htmlFor="form-ads-basic-terms" className="font-normal">
													I accept the terms
												</FieldLabel>
											</Field>
										</FieldGroup>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</FieldSet>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-ads-basic">
						Create account
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoAdsFieldValidation() {
	const form = useForm({
		defaultValues: {
			username: "",
		},
		validators: {
			onChange: adsValidationFormSchema,
			onSubmit: adsValidationFormSchema,
		},
		onSubmit: async ({ value }) => {
			showSubmittedValuesToast(value);
		},
	});

	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Field Validation</CardTitle>
				<CardDescription>Validation message appears while you type.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					id="form-ads-validation"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="username">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor="form-ads-validation-username">Username</FieldLabel>
										<Input
											id="form-ads-validation-username"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											aria-invalid={isInvalid}
											placeholder="at least 3 characters"
											autoComplete="off"
										/>
										<FieldDescription>Use 3 to 20 characters.</FieldDescription>
										{isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
									</Field>
								);
							}}
						</form.Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" onClick={() => form.reset()}>
						Reset
					</Button>
					<Button type="submit" form="form-ads-validation">
						Submit
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}

export function FormDemoAdsDisabled() {
	return (
		<Card className="w-[28rem] max-w-full">
			<CardHeader>
				<CardTitle>Disabled Form</CardTitle>
				<CardDescription>Example of a disabled form state.</CardDescription>
			</CardHeader>
			<CardContent>
				<form id="form-ads-disabled">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="form-ads-disabled-username">Username</FieldLabel>
							<Input id="form-ads-disabled-username" defaultValue="jdoe" disabled />
						</Field>
						<Field orientation="horizontal">
							<Checkbox id="form-ads-disabled-terms" checked disabled />
							<FieldLabel htmlFor="form-ads-disabled-terms" className="font-normal">
								Terms accepted
							</FieldLabel>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
			<CardFooter>
				<Field orientation="horizontal">
					<Button type="button" variant="outline" disabled>
						Reset
					</Button>
					<Button type="submit" form="form-ads-disabled" disabled>
						Save
					</Button>
				</Field>
			</CardFooter>
		</Card>
	);
}
