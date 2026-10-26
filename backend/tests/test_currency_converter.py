"""Unit tests for Multi-Currency & Cryptocurrency Oracle Exchange Engine."""

import unittest

from backend.app.services.currency_converter import (
    SupportedCurrency,
    convert_minor_to_minor,
    create_conversion_quote,
    generate_deposit_address,
)


class TestCurrencyConverter(unittest.TestCase):
    def test_identity_conversion(self):
        # 10,000 XTS minor to XTS minor should yield 10,000 with 0 fee
        dest, fee, rate = convert_minor_to_minor(10_000, SupportedCurrency.XTS, SupportedCurrency.XTS)
        self.assertEqual(dest, 10_000)
        self.assertEqual(fee, 0)
        self.assertEqual(rate, 1.0)

    def test_usd_to_eur_conversion(self):
        # $100.00 USD (10,000 cents) to EUR (rate 1.08 USD/EUR)
        # Expected: ~92.59 EUR minus 0.5% spread = ~92.12 EUR (9,212 cents)
        dest, fee, rate = convert_minor_to_minor(
            amount_minor=10_000,
            from_curr=SupportedCurrency.USD,
            to_curr=SupportedCurrency.EUR,
            spread_pct=0.5,
        )
        self.assertGreater(dest, 9_000)
        self.assertLess(dest, 9_300)
        self.assertGreater(fee, 0)

    def test_btc_to_xts_conversion(self):
        # 0.1 BTC = 10,000,000 satoshis @ $68,500/BTC
        # Value = $6,850.00 -> in XTS (1 XTS = 1 USD) = 685,000 minor units minus 0.5% spread
        dest, fee, rate = convert_minor_to_minor(
            amount_minor=10_000_000,  # 0.1 BTC
            from_curr=SupportedCurrency.BTC,
            to_curr=SupportedCurrency.XTS,
            spread_pct=0.5,
        )
        self.assertGreater(dest, 680_000)
        self.assertLess(dest, 685_000)

    def test_deterministic_deposit_addresses(self):
        btc_addr = generate_deposit_address("user-alpha", SupportedCurrency.BTC)
        eth_addr = generate_deposit_address("user-alpha", SupportedCurrency.ETH)
        sol_addr = generate_deposit_address("user-alpha", SupportedCurrency.SOL)

        self.assertTrue(btc_addr.startswith("bc1q"))
        self.assertTrue(eth_addr.startswith("0x"))
        self.assertTrue(sol_addr.startswith("Sol"))

        # Determinism check: same user and coin yields same address
        self.assertEqual(btc_addr, generate_deposit_address("user-alpha", SupportedCurrency.BTC))

    def test_conversion_quote_creation(self):
        quote = create_conversion_quote(
            user_id="user-bravo",
            from_curr=SupportedCurrency.EUR,
            to_curr=SupportedCurrency.XTS,
            from_minor_amount=5_000,  # 50.00 EUR
            quote_validity_seconds=60,
        )

        self.assertEqual(quote.from_currency, SupportedCurrency.EUR)
        self.assertEqual(quote.to_currency, SupportedCurrency.XTS)
        self.assertGreater(quote.to_minor_amount, 5_000)  # EUR > USD/XTS
        self.assertGreater(quote.expires_at_unix, 0)
        self.assertIsNotNone(quote.deposit_address)


if __name__ == "__main__":
    unittest.main()
