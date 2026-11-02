// src/components/ui/__tests__/ActionButtons.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CopyButton } from "@/components/ui/ActionButtons"
import { copyTextToClipboard } from "@/lib/clipboard"

vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn() }))

const copyMock = vi.mocked(copyTextToClipboard)

afterEach(() => {
  copyMock.mockReset()
})

describe("CopyButton", () => {
  it("reports a successful copy on the button and to assistive tech", async () => {
    copyMock.mockResolvedValue("copied")
    const user = userEvent.setup()

    render(<CopyButton value="secret" label="Copy" />)
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))

    expect(copyMock).toHaveBeenCalledWith("secret")
    expect(await screen.findByText("Copied")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard")
  })

  it("shows a visible message when the clipboard is unavailable", async () => {
    // This is the plain-HTTP-on-the-LAN case the helper exists for: the copy
    // must not look like it worked.
    copyMock.mockResolvedValue("unavailable")
    const user = userEvent.setup()

    render(<CopyButton value="secret" label="Copy" />)
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))

    expect(await screen.findByText("Copy unavailable")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Clipboard unavailable")
  })

  it("widens an icon-only button to say the copy failed", async () => {
    copyMock.mockResolvedValue("unavailable")
    const user = userEvent.setup()

    render(<CopyButton value="secret" />)
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))

    const button = await screen.findByRole("button", { name: "Clipboard unavailable" })
    expect(button).toHaveTextContent("Copy unavailable")
  })
})
