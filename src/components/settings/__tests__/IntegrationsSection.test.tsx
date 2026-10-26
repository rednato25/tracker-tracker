import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { IntegrationsSection } from "@/components/settings/IntegrationsSection"

const fetchMock = vi.fn()
const token = `tt_int_${"b".repeat(43)}`
const record = {
  id: 12,
  name: "Living room",
  scopes: ["summary:read", "history:read"],
  createdAt: "2026-10-26T10:00:00.000Z",
  lastUsedAt: null,
  revokedAt: null,
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/settings/integration-tokens" && !init?.method) {
      return { ok: true, status: 200, json: async () => ({ tokens: [] }) }
    }
    if (url === "/api/settings" && init?.method === "PATCH") {
      return { ok: true, status: 200, json: async () => ({ integrationIdentityMode: "trackers" }) }
    }
    if (url === "/api/settings/integration-tokens" && init?.method === "POST") {
      return { ok: true, status: 201, json: async () => ({ token, record }) }
    }
    if (url === "/api/settings/integration-tokens/12" && init?.method === "DELETE") {
      return { ok: true, status: 200, json: async () => ({ revoked: true, id: 12 }) }
    }
    throw new Error(`unexpected fetch ${url}`)
  })
})

describe("IntegrationsSection", () => {
  it("shows the privacy-preserving identity default and saves an explicit change", async () => {
    const user = userEvent.setup()
    render(<IntegrationsSection initialIdentityMode="none" />)

    const trigger = screen.getByRole("button", { name: "Tracker identity disclosure" })
    expect(trigger).toHaveTextContent("Hidden (recommended)")

    await user.click(trigger)
    await user.click(screen.getByRole("option", { name: "Tracker names" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/settings",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ integrationIdentityMode: "trackers" }),
        })
      )
    })
  })

  it("creates a token, shows the plaintext once, then drops it from the UI", async () => {
    const user = userEvent.setup()
    render(<IntegrationsSection initialIdentityMode="none" />)

    await screen.findByText("No active integration tokens.")
    await user.type(screen.getByLabelText("Token name"), "Living room")
    await user.click(screen.getByRole("button", { name: "Create token" }))

    expect(await screen.findByText("Copy this token now")).toBeInTheDocument()
    expect(screen.getByText(token)).toBeInTheDocument()
    expect(screen.getByText("Living room")).toBeInTheDocument()

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      name: "Living room",
      scopes: ["summary:read", "actions:read", "history:read"],
    })

    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText(token)).not.toBeInTheDocument()
    expect(screen.queryByText("Copy this token now")).not.toBeInTheDocument()
  })

  it("revokes immediately after an explicit confirmation", async () => {
    const user = userEvent.setup()
    render(<IntegrationsSection initialIdentityMode="none" />)

    await user.type(screen.getByLabelText("Token name"), "Living room")
    await user.click(screen.getByRole("button", { name: "Create token" }))
    await screen.findByText("Copy this token now")
    await user.click(screen.getByRole("button", { name: "Dismiss" }))

    await user.click(screen.getByRole("button", { name: "Revoke" }))
    expect(screen.getByText(/will stop working immediately/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Revoke token" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/settings/integration-tokens/12", {
        method: "DELETE",
      })
    })
    expect(screen.queryByText("Living room")).not.toBeInTheDocument()
  })

  it("surfaces create failures without showing a token", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/settings/integration-tokens" && init?.method === "POST") {
        return { ok: false, status: 400, json: async () => ({ error: "Too many tokens" }) }
      }
      return { ok: true, status: 200, json: async () => ({ tokens: [] }) }
    })

    render(<IntegrationsSection initialIdentityMode="none" />)
    await user.type(screen.getByLabelText("Token name"), "Living room")
    await user.click(screen.getByRole("button", { name: "Create token" }))

    expect(await screen.findByText("Too many tokens")).toBeInTheDocument()
    expect(screen.queryByText("Copy this token now")).not.toBeInTheDocument()
  })
})
