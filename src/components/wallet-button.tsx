import { useRef } from "react"
import { ConnectModal } from "@mysten/dapp-kit-react/ui"
import type { DAppKitConnectModal } from "@mysten/dapp-kit-core/web"
import { BadgeCheck, LogOut, PenLine, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { shortAddr } from "@/lib/api"
import { cn } from "@/lib/utils"
import { dAppKit, useWalletSession } from "@/lib/wallet"

export function WalletButton({
  className,
  size = "sm",
  variant = "default",
}: {
  className?: string
  size?: "sm" | "xs" | "default"
  variant?: "default" | "outline"
}) {
  const modal = useRef<DAppKitConnectModal>(null)
  const { account, verified, verifying, error, verify, disconnect } = useWalletSession()

  if (!account) {
    return (
      <>
        <Button size={size} variant={variant} className={className} onClick={() => modal.current?.show()}>
          <Wallet data-icon="inline-start" />
          Connect wallet
        </Button>
        <ConnectModal ref={modal} instance={dAppKit} />
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline" className={cn("normal-case tracking-normal", className)}>
          {verified ? (
            <BadgeCheck data-icon="inline-start" className="text-emerald-600" />
          ) : (
            <Wallet data-icon="inline-start" />
          )}
          <span className="font-mono">{shortAddr(account.address)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {verified
            ? "Verified. Your support history and memory follow this wallet."
            : error
              ? `Not verified: ${error}`
              : "Sign once to prove it's you and unlock priority support."}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!verified && (
          <DropdownMenuItem disabled={verifying} onSelect={() => void verify()}>
            <PenLine /> {verifying ? "Waiting for signature…" : "Sign in with wallet"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void disconnect()}>
          <LogOut /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
