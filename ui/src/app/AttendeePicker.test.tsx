import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendeePicker, type PickerOption } from "./AttendeePicker";

const OPTIONS: PickerOption[] = [
  { id: "1", name: "Alice Adams", hint: "Internal" },
  { id: "2", name: "Bob Brown", hint: "Internal" },
];

describe("AttendeePicker", () => {
  it("filters by typed text and adds the chosen option", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <AttendeePicker selected={[]} options={OPTIONS} onAdd={onAdd} onRemove={() => {}} />,
    );

    await user.type(screen.getByPlaceholderText("Type a name…"), "ali");
    const match = await screen.findByText("Alice Adams");
    await user.click(match);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("renders selected chips and removes them", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <AttendeePicker
        selected={[{ id: "1", name: "Alice Adams" }]}
        options={OPTIONS}
        onAdd={() => {}}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("Alice Adams")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Remove Alice Adams"));
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("offers to create a new entry when nothing matches", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <AttendeePicker
        selected={[]}
        options={OPTIONS}
        onAdd={() => {}}
        onRemove={() => {}}
        onCreate={onCreate}
      />,
    );

    await user.type(screen.getByPlaceholderText("Type a name…"), "Carol");
    await user.click(await screen.findByText(/Add .Carol./));
    expect(onCreate).toHaveBeenCalledWith("Carol");
  });
});
