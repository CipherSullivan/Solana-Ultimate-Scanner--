#!/usr/bin/env python3
# Solana Address Scanner - Enhanced Backend
# This script scans Solana addresses and checks for security issues

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
import threading
import requests
import base58
from typing import Dict, List, Any, Optional
import os
import csv
import re

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("solana_scanner.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("solana_scanner")

# Initialize FastAPI app
app = FastAPI(title="Solana Address Scanner API")

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
# For RPC endpoint, replace this with your dedicated endpoint from QuickNode, Helius, etc.
SOLANA_RPC_URL = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")

# API key for price data
COIN_API_KEY = os.environ.get("COIN_API_KEY", "")

# Cache storage
class Cache:
    def __init__(self, expiry_seconds=300):  # 5 minute default cache
        self.data = {}
        self.expiry = expiry_seconds
    
    def get(self, key):
        if key in self.data:
            entry = self.data[key]
            if datetime.now() < entry['expiry']:
                return entry['value']
            else:
                del self.data[key]
        return None
    
    def set(self, key, value):
        self.data[key] = {
            'value': value,
            'expiry': datetime.now() + timedelta(seconds=self.expiry)
        }

# Initialize caches
token_metadata_cache = Cache(expiry_seconds=3600)  # 1 hour cache
price_cache = Cache(expiry_seconds=300)  # 5 minute cache for prices
token_list_cache = Cache(expiry_seconds=86400)  # 24 hour cache for token list
security_cache = Cache(expiry_seconds=3600)  # 1 hour cache for security issues

# In-memory storage for addresses and their data
address_data = {}
connected_clients = set()
historical_data = {}  # Store historical portfolio values

class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")

manager = ConnectionManager()

def get_account_balance(address: str) -> float:
    """Get account balance in SOL using direct RPC call."""
    try:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [address]
        }
        
        response = requests.post(SOLANA_RPC_URL, json=payload)
        result = response.json()
        
        if 'result' in result and 'value' in result['result']:
            # Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
            balance_sol = result['result']['value'] / 1_000_000_000
            return balance_sol
        else:
            logger.error(f"Unexpected response format: {result}")
            return 0.0
    except Exception as e:
        logger.error(f"Error getting balance for {address}: {e}")
        return 0.0

def get_token_accounts(address: str) -> list:
    """Get token accounts owned by this wallet address."""
    try:
        cached = token_metadata_cache.get(f"token_accounts_{address}")
        if cached:
            return cached
            
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                address,
                {
                    "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
                },
                {
                    "encoding": "jsonParsed"
                }
            ]
        }
        
        response = requests.post(SOLANA_RPC_URL, json=payload)
        result = response.json()
        
        if 'result' in result and 'value' in result['result']:
            token_accounts = result['result']['value']
            token_metadata_cache.set(f"token_accounts_{address}", token_accounts)
            return token_accounts
        else:
            logger.error(f"Unexpected response format for token accounts: {result}")
            return []
    except Exception as e:
        logger.error(f"Error getting token accounts for {address}: {e}")
        return []

def load_token_list():
    """Load token list from Solana token list or cache."""
    cached = token_list_cache.get("token_list")
    if cached:
        return cached
        
    try:
        # Try to load from Jupiter token list (more comprehensive than Solana's)
        response = requests.get("https://token.jup.ag/all")
        if response.status_code == 200:
            token_list = response.json()
            # Convert to dictionary by mint address for faster lookups
            token_dict = {token['address']: token for token in token_list}
            token_list_cache.set("token_list", token_dict)
            return token_dict
    except Exception as e:
        logger.error(f"Error loading token list: {e}")
    
    # Fallback to empty token list with just basic entries
    return {
        "So11111111111111111111111111111111111111112": {
            "name": "Wrapped SOL",
            "symbol": "wSOL",
            "logoURI": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
            "address": "So11111111111111111111111111111111111111112",
            "decimals": 9
        },
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
            "name": "USD Coin",
            "symbol": "USDC",
            "logoURI": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png", 
            "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "decimals": 6
        }
    }

def get_token_metadata(mint_address: str) -> dict:
    """Get token metadata from cache or token list."""
    cached = token_metadata_cache.get(f"token_{mint_address}")
    if cached:
        return cached
        
    # Load token list if needed
    token_list = load_token_list()
    
    # Get token from list or use default
    token = token_list.get(mint_address, {
        "name": f"Unknown Token ({mint_address[:6]}...)",
        "symbol": "???",
        "logoURI": "",
        "address": mint_address,
        "decimals": 9
    })
    
    # Format the response
    metadata = {
        "name": token.get("name", f"Unknown Token ({mint_address[:6]}...)"),
        "symbol": token.get("symbol", "???"),
        "logo": token.get("logoURI", ""),
        "address": mint_address,
        "decimals": token.get("decimals", 9)
    }
    
    # Cache the metadata
    token_metadata_cache.set(f"token_{mint_address}", metadata)
    return metadata

def get_token_prices(symbols: List[str]) -> Dict[str, float]:
    """Get token prices from CoinGecko or other price API."""
    # Check cache first
    cached = price_cache.get("token_prices")
    if cached:
        return cached
    
    prices = {}
    
    # First, try to get real prices from CoinGecko if API key is set
    if COIN_API_KEY:
        try:
            # Convert symbols to CoinGecko IDs (simplified mapping)
            symbol_to_id = {
                "SOL": "solana",
                "BTC": "bitcoin",
                "ETH": "ethereum",
                "USDC": "usd-coin",
                "USDT": "tether",
                "RAY": "raydium",
                "SRM": "serum",
                "BONK": "bonk",
                "SAMO": "samoyedcoin",
                # Add more mappings as needed
            }
            
            # Get IDs for the symbols we have
            ids = [symbol_to_id[s.upper()] for s in symbols if s.upper() in symbol_to_id]
            
            if ids:
                # Example for CoinGecko
                ids_param = ",".join(ids)
                url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_param}&vs_currencies=usd&x_cg_demo_api_key={COIN_API_KEY}"
                response = requests.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    # Map back from CoinGecko IDs to symbols
                    id_to_symbol = {v: k for k, v in symbol_to_id.items()}
                    
                    for coin_id, price_data in data.items():
                        if coin_id in id_to_symbol and 'usd' in price_data:
                            symbol = id_to_symbol[coin_id]
                            prices[symbol] = price_data['usd']
        
        except Exception as e:
            logger.error(f"Error getting prices from API: {e}")
    
    # Fallback to realistic estimates for any missing tokens
    default_prices = {
        "SOL": 111.45,
        "USDC": 1.00,
        "USDT": 1.00,
        "BTC": 64000.00,
        "ETH": 3500.00,
        "RAY": 0.54,
        "SRM": 0.22,
        "BONK": 0.00002,
        "SAMO": 0.015,
        "WSOL": 111.45,
    }
    
    # Fill in any missing prices with default data
    for symbol in symbols:
        if symbol.upper() not in prices:
            prices[symbol.upper()] = default_prices.get(symbol.upper(), 0.1)
    
    # Cache the prices
    price_cache.set("token_prices", prices)
    return prices

def get_account_transactions(address: str, limit: int = 10) -> list:
    """Get recent transactions for an account using direct RPC call."""
    try:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [address, {"limit": limit}]
        }
        
        response = requests.post(SOLANA_RPC_URL, json=payload)
        result = response.json()
        
        if 'result' in result:
            return result['result']
        else:
            logger.error(f"Unexpected response format: {result}")
            return []
    except Exception as e:
        logger.error(f"Error getting transactions for {address}: {e}")
        return []

def get_nfts_by_owner(owner_address: str, limit: int = 50) -> list:
    """Get NFTs owned by this address using Helius API if available."""
    if "helius" in SOLANA_RPC_URL:
        # If using Helius, we can get NFTs
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": "my-id",
                "method": "getAssetsByOwner",
                "params": {
                    "ownerAddress": owner_address,
                    "page": 1,
                    "limit": limit,
                    "displayOptions": {
                        "showFungible": False
                    }
                }
            }
            
            response = requests.post(SOLANA_RPC_URL, json=payload)
            result = response.json()
            
            if 'result' in result and 'items' in result['result']:
                return result['result']['items']
            else:
                logger.error(f"Unexpected NFT response format: {result}")
                return []
        except Exception as e:
            logger.error(f"Error getting NFTs: {e}")
            return []
    
    # If not using Helius, return empty list
    return []

def store_historical_data(address: str, total_value: float):
    """Store historical portfolio value data."""
    if address not in historical_data:
        historical_data[address] = []
    
    # Store timestamp and value
    historical_data[address].append({
        "timestamp": datetime.now().isoformat(),
        "value": total_value
    })
    
    # Keep only last 30 days of data
    if len(historical_data[address]) > 30:
        historical_data[address] = historical_data[address][-30:]

def check_security_issues(address: str, transactions=None) -> dict:
    """Check for security issues with a wallet."""
    # Check cache first
    cached = security_cache.get(f"security_{address}")
    if cached:
        return cached
    
    security_issues = {
        "status": "secure",  # Can be "secure", "warning", or "critical"
        "issues": [],
        "risk_score": 0,  # 0-100, higher is more risky
        "last_checked": datetime.now().isoformat()
    }
    
    # Get transactions if not provided
    if not transactions:
        transactions = get_account_transactions(address, limit=20)
    
    try:
        # 1. Check for public leak/exposure of the address
        # In a real implementation, you would query a security database
        # This would be implemented with a proper API call to a security service
        
        # 2. Check for suspicious transaction patterns
        # Implement with a proper security database lookup
        suspicious_tx_count = 0
        
        # 3. Check for potentially dangerous token approvals
        token_accounts = get_token_accounts(address)
        risky_approvals = 0
        
        for account in token_accounts:
            if 'data' in account['account'] and 'parsed' in account['account']['data']:
                info = account['account']['data']['parsed']['info']
                # Check for delegate approvals
                if 'delegate' in info and info['delegate'] != address:
                    risky_approvals += 1
        
        if risky_approvals > 0:
            security_issues["issues"].append({
                "type": "token_approvals",
                "severity": "warning",
                "description": f"Found {risky_approvals} active token approvals that may be risky.",
                "details": "These approvals allow other programs to spend tokens in this wallet."
            })
            security_issues["status"] = "warning"
            security_issues["risk_score"] += risky_approvals * 10
        
        # 4. Check wallet activity patterns
        if len(transactions) == 0:
            security_issues["issues"].append({
                "type": "inactive_wallet",
                "severity": "info",
                "description": "No recent activity detected on this wallet.",
                "details": "Inactive wallets may indicate dormant or abandoned accounts."
            })
        
        # 5. Age of the wallet
        wallet_age_days = 0
        if transactions and len(transactions) > 0:
            if 'blockTime' in transactions[-1]:
                oldest_tx_time = transactions[-1]['blockTime']
                current_time = int(time.time())
                wallet_age_days = (current_time - oldest_tx_time) / (60 * 60 * 24)
        
        if wallet_age_days < 7:
            security_issues["issues"].append({
                "type": "new_wallet",
                "severity": "info",
                "description": "This appears to be a recently created wallet.",
                "details": f"Wallet age is approximately {wallet_age_days:.1f} days."
            })
        
        # Cap risk score at 100
        security_issues["risk_score"] = min(security_issues["risk_score"], 100)
        
    except Exception as e:
        logger.error(f"Error checking security issues: {e}")
        security_issues["issues"].append({
            "type": "scan_error",
            "severity": "info",
            "description": "Error occurred during security scan.",
            "details": str(e)
        })
    
    # Cache results
    security_cache.set(f"security_{address}", security_issues)
    return security_issues

def get_addresses_from_db():
    """Get Solana addresses from database or configuration."""
    # In a real implementation, you would fetch addresses from a database
    # This function would be replaced with actual database queries
    
    # For now, return an empty list - addresses will be added by clients
    return []

async def update_account_data(address: str):
    """Update stored data for an account and broadcast to clients."""
    try:
        # Start with progressive loading - first send basic data
        # Get SOL balance
        sol_balance = get_account_balance(address)
        
        # Get initial data
        initial_data = {
            "address": address,
            "balance": sol_balance,
            "lastUpdated": datetime.now().isoformat(),
            "loadingStage": "basic_info",
            "portfolio": [
                {
                    "type": "SOL",
                    "name": "Solana",
                    "symbol": "SOL",
                    "balance": sol_balance,
                    "usd_value": sol_balance * 111.45,  # Initial estimate
                    "logo": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                }
            ]
        }
        
        # Update stored data with initial info
        address_data[address] = initial_data
        
        # Broadcast initial update
        await manager.broadcast(json.dumps({
            "type": "account_update",
            "data": initial_data
        }))
        
        # Now get transactions
        transactions = get_account_transactions(address)
        address_data[address]["recentTransactions"] = transactions
        address_data[address]["loadingStage"] = "transactions"
        
        # Broadcast transactions update
        await manager.broadcast(json.dumps({
            "type": "account_update",
            "data": address_data[address]
        }))
        
        # Get token accounts (this can be slow)
        token_accounts = get_token_accounts(address)
        
        # Process token balances
        portfolio = [
            {
                "type": "SOL",
                "name": "Solana",
                "symbol": "SOL",
                "balance": sol_balance,
                "usd_value": sol_balance * 111.45,  # Will be updated with real price
                "logo": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
            }
        ]
        
        # Collect symbols for price lookup
        symbols = ["SOL"]
        
        # Add token balances to portfolio
        for account in token_accounts:
            try:
                if 'data' in account['account'] and 'parsed' in account['account']['data']:
                    info = account['account']['data']['parsed']['info']
                    
                    if 'tokenAmount' in info:
                        mint = info.get('mint', '')
                        amount = int(info['tokenAmount']['amount'])
                        decimals = info['tokenAmount']['decimals']
                        
                        if amount > 0:  # Only add tokens with non-zero balance
                            token_balance = amount / (10 ** decimals)
                            
                            # Get token metadata
                            token_meta = get_token_metadata(mint)
                            
                            # Add symbol to price lookup list
                            if token_meta.get("symbol", "???") != "???":
                                symbols.append(token_meta.get("symbol"))
                            
                            # Will update price later
                            token_data = {
                                "type": "SPL",
                                "mint": mint,
                                "name": token_meta.get("name", "Unknown Token"),
                                "symbol": token_meta.get("symbol", "???"),
                                "balance": token_balance,
                                "usd_value": 0,  # Will set this after getting prices
                                "logo": token_meta.get("logo", "")
                            }
                            
                            portfolio.append(token_data)
            except Exception as e:
                logger.error(f"Error processing token account: {e}")
        
        # Update with token data
        address_data[address]["portfolio"] = portfolio
        address_data[address]["loadingStage"] = "tokens"
        
        # Broadcast token update
        await manager.broadcast(json.dumps({
            "type": "account_update",
            "data": address_data[address]
        }))
        
        # Now get prices for all tokens
        token_prices = get_token_prices(symbols)
        
        # Update portfolio with prices
        for token in portfolio:
            symbol = token.get("symbol", "").upper()
            if symbol in token_prices:
                token["usd_value"] = token["balance"] * token_prices[symbol]
        
        # Sort portfolio by USD value (descending)
        portfolio.sort(key=lambda x: x.get('usd_value', 0), reverse=True)
        
        # Calculate total portfolio value
        total_value = sum(item.get('usd_value', 0) for item in portfolio)
        
        # Try to get NFTs if using Helius
        nfts = get_nfts_by_owner(address)
        
        # Store historical data point
        store_historical_data(address, total_value)
        
        # Check for security issues
        security_issues = check_security_issues(address, transactions)
        
        # Final data update
        address_data[address] = {
            "address": address,
            "balance": sol_balance,
            "lastUpdated": datetime.now().isoformat(),
            "recentTransactions": transactions,
            "portfolio": portfolio,
            "totalValue": total_value,
            "nfts": nfts,
            "historicalData": historical_data.get(address, []),
            "security": security_issues,
            "loadingStage": "complete"
        }
        
        # Broadcast final update
        await manager.broadcast(json.dumps({
            "type": "account_update",
            "data": address_data[address]
        }))
        
    except Exception as e:
        logger.error(f"Error updating account data for {address}: {e}")

def periodic_scanner_thread():
    """Run periodic scan in a background thread."""
    while True:
        try:
            # Get current addresses from database
            addresses = get_addresses_from_db()
            
            # Update data for each address
            for address in addresses:
                if address not in address_data:
                    # We can't use async functions directly in a thread
                    # So we just update the data without broadcasting
                    balance = get_account_balance(address)
                    transactions = get_account_transactions(address)
                    security = check_security_issues(address, transactions)
                    
                    address_data[address] = {
                        "address": address,
                        "balance": balance,
                        "lastUpdated": datetime.now().isoformat(),
                        "recentTransactions": transactions,
                        "security": security
                    }
            
            # We can't broadcast from a thread, but the data is updated
            # and will be sent when clients connect or request updates
            
        except Exception as e:
            logger.error(f"Error in periodic scanner: {e}")
        
        # Sleep for 60 seconds
        time.sleep(60)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial data on connect
        await websocket.send_text(json.dumps({
            "type": "full_update",
            "data": list(address_data.values())
        }))
        
        # Keep connection alive and handle messages
        while True:
            data = await websocket.receive_text()
            request = json.loads(data)
            
            if request["type"] == "get_account":
                address = request.get("address")
                if address:
                    await update_account_data(address)
            
            elif request["type"] == "refresh_all":
                # Send current data
                await websocket.send_text(json.dumps({
                    "type": "full_update",
                    "data": list(address_data.values())
                }))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/api/accounts")
async def get_accounts():
    """API endpoint to get all tracked accounts."""
    return JSONResponse({
        "accounts": list(address_data.values())
    })

@app.get("/api/account/{address}")
async def get_account(address: str):
    """API endpoint to get data for a specific account."""
    if address in address_data:
        return JSONResponse(address_data[address])
    else:
        # Fetch data first time
        balance = get_account_balance(address)
        transactions = get_account_transactions(address)
        
        # Store minimal data
        address_data[address] = {
            "address": address,
            "balance": balance,
            "lastUpdated": datetime.now().isoformat(),
            "recentTransactions": transactions,
            "loadingStage": "basic_info"
        }
        
        # Start background update
        # This is a hack - we should use a task queue in production
        threading.Thread(target=lambda: asyncio.run(update_account_data(address))).start()
        
        return JSONResponse(address_data[address])

@app.on_event("startup")
def startup_event():
    # Start background thread
    scanner_thread = threading.Thread(target=periodic_scanner_thread, daemon=True)
    scanner_thread.start()
    
    # Load initial data from database if available
    addresses = get_addresses_from_db()
    for address in addresses:
        balance = get_account_balance(address)
        address_data[address] = {
            "address": address,
            "balance": balance,
            "lastUpdated": datetime.now().isoformat(),
            "loadingStage": "basic_info"
        }

if __name__ == "__main__":
    # Read port from environment variable or use default
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)