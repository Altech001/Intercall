import { useCallback, useEffect, useRef, useState } from "react"
import { createDAppKit, useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react"
import { SuiGrpcClient } from "@mysten/sui/grpc"
import { api, type PublicCustomer } from "./api"
import { identity, useIdentity } from "./identity"

const NETWORK = (import.meta.env.VITE_SUI_NETWORK ?? "testnet") as "testnet" | "mainnet"

export const dAppKit = createDAppKit({
  networks: [NETWORK],
  defaultNetwork: NETWORK,
  autoConnect: true,
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: `https://fullnode.${network}.sui.io:443` }),
})

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit
  }
}

/**
 * Connected wallet + InterCall session. Connecting prompts one signature that
 * proves ownership; the server then links this visitor's tickets and Walrus
 * memories to the wallet so they follow the customer across devices.
 */
export function useWalletSession() {
  const account = useCurrentAccount()
  const kit = useDAppKit()
  const id = useIdentity()
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string>()
  const asked = useRef<string | undefined>(undefined)

  const verified = !!account && id.address === account.address && !!id.token

  const verify = useCallback(async () => {
    if (!account) return
    setVerifying(true)
    setError(undefined)
    try {
      const { nonce } = await api<{ nonce: string }>("/api/auth/nonce")
      const message = `InterCall wants you to sign in with your Sui wallet.\n\nAddress: ${account.address}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`
      const { signature } = await kit.signPersonalMessage({
        message: new TextEncoder().encode(message),
      })
      const res = await api<{ token: string; customer: PublicCustomer }>("/api/auth/verify", {
        body: { address: account.address, message, signature, visitorId: identity.get().visitorId },
      })
      identity.set({ token: res.token, address: account.address, customer: res.customer })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setVerifying(false)
    }
  }, [account, kit])

  // Ask for the sign-in signature once per newly connected account. The session
  // itself outlives the page, so auto-reconnect on reload doesn't prompt again.
  useEffect(() => {
    if (account && !verified && asked.current !== account.address) {
      asked.current = account.address
      void verify()
    }
  }, [account, verified, verify])

  const disconnect = useCallback(async () => {
    await kit.disconnectWallet()
    identity.signOut()
  }, [kit])

  return { account, verified, verifying, error, verify, disconnect }
}
