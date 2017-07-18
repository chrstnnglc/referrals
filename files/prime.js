// gets discount based on qty
function getDiscount (quantity) {
  var d = discountJSON[quantity]

  if (d === 0 || d) {
    // cant just use if (d) because 0 is not truthy
    return d
  }

  return discountJSON[Object.keys(discountJSON).length]
}

function getPricePerItem (quantity) {
  return price - (price * getDiscount(quantity))
}

function formatPrice (x) {
  if (currency === 'JPY') {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  return x.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function calcPerItem (x) {
  return formatPrice(getPricePerItem(x))
}

function calcTotal (x) {
  /*
    Given a number, adds that number to past license quantity

    returns total to be paid and an object detailing item breakdown and price
  */
  var total = 0
  var list = {}

  for (var i = 1 + pastLicenseQty; i <= parseInt(x) + pastLicenseQty; i++) {
    list[calcPerItem(i)] = (list[calcPerItem(i)] || 0) + 1
    total += Math.round(getPricePerItem(i) * 100) / 100
  }

  var returnedHTML = ''

  for (var key in list) {
    if (list.hasOwnProperty(key)) {
      returnedHTML += '<tr><td></td><td>' + list[key] + '</td><td class="times">x</td><td><strong>' + currencySymbol + key + '</strong></td></tr>'
    }
  }

  returnedHTML += '<tr><td>TOTAL</td><td></td><td></td><td><strong>' + currencySymbol + formatPrice(total) + '</strong></td></tr>'

  var stripeAmount = total

  if (currency != 'JPY') {
    stripeAmount *= 100
  }

  return {
    total: formatPrice(total),
    HTML: returnedHTML,
    stripeAmount: Math.round(stripeAmount)
  }
}

function setUIAmounts (x) {
  var currentLicenseCount = parseInt(x) + pastLicenseQty
  if (currentLicenseCount < 2) {
    $('.orig-price').hide()
    $('.price .discount').hide()
  } else {
    $('.orig-price').show()
    $('.price .discount').show()
    $('.price .discount').html((getDiscount(currentLicenseCount) * 100) + '%<br>OFF')
  }
  $('.orig-price .amount').text(formatPrice(price))
  $('.price .amount').text(calcPerItem(currentLicenseCount))

  var o = calcTotal(x)
  $('.item-container .breakdown').html(o.HTML)
  $('.price .total').text(o.total)
  amountDue = o.stripeAmount

}

function highlightTier (quantity) {
  var qty = parseInt(quantity) + pastLicenseQty
  $('.discount-table .row').removeAttr('style')
  if (qty >= 2 && qty <= 5) {
    $('.tier-1').css('backgroundColor', '#bbeff7')
  } else if (qty >= 6 && qty <= 10) {
    $('.tier-2').css('backgroundColor', '#bbeff7')
  } else if (qty >= 11 && qty <= 20) {
    $('.tier-3').css('backgroundColor', '#bbeff7')
  } else if (qty >= 21 && qty <= 30) {
    $('.tier-4').css('backgroundColor', '#bbeff7')
  } else if (qty > 30) {
    $('.tier-5').css('backgroundColor', '#bbeff7')
  }
}

function applyCoupon (e) {
  e.preventDefault()
  if ($('.coupon-code').val() !== '') {
    var $input = $('.coupon-input input')
    $.ajax({
      url: '/buy/prime/apply-coupon',
      type: 'post',
      dataType: 'json',
      data: {
        coupon: $input.val().toUpperCase()
      }
    }).done(function (resp) {
      $('input[name=coupon]').val(resp.coupon)

      var discountText = resp.discount_text + ' valid for one (1) new license.'
      if ($('input[type=number]').val() > 1) {
        discountText += ' Please note that your quantity has been set to 1 as this specific coupon is not valid for bulk purchases.'
      }

      discountText += '<br> <a href="' + primeURL + '">Cancel coupon.</a>'
      $('.coupon-app').hide()

      $('.info-container').html(
        $('<div />')
          .addClass('discount')
          .html(discountText)
      )

      $('.bulk-input .bulk-row').hide()
      $('.dash-notice').hide()
      $('.orig-price').show()
      $('.price .discount').html((resp.discount * 100) + '%<br>OFF').show()
      $('.price .amount').text(formatPrice(price - (price * resp.discount))).show()
      amountDue = price - (price * resp.discount)
      if (currency !== 'JPY') {
        amountDue *= 100
      }
    }).error(function () {
      $input
        .val('Invalid coupon')
        .select()
    })
  }
}

/*
  QUANTITY STEPPER
*/

$("input[type=number]").stepper()
// Change prices displayed when quantity is changed
$('input[name=quantity]').on('input change', function (e) {
  highlightTier(e.target.value)
  setUIAmounts(e.target.value)
})

/*
  EVENT HANDLERS
*/

// Go to appropriate URL when changing currency
$('#currency-changer').on('change', function (e) {
  window.location.href = primeURL + '/' + e.target.value
})

// Handler for when you click on "Have a coupon code?"
$('.coupon-show').on('click', function (e) {
  $(this).hide()
  $('.coupon-input').show()
  $('.coupon-code').prop('disabled', false)
  $('.coupon-code').focus()
  e.preventDefault()
})

$('.coupon .apply-coupon').on('click', applyCoupon)
$('.coupon-code').keypress(function (e) {
  if (e.which == 13) {
    applyCoupon(e)
  }
})

$('#paypal-form').submit(showLoading)

$('.stripe-checkout').click(function(e) {
  // Open Checkout with further options:
  handler.open({
    name: 'InsyncHQ',
    description: 'Insync Prime license(s) x ' + ($('input[name=quantity]').val() || quantity),
    amount: amountDue,
    email: $('#user_email').val() || defaultEmail,
    bitcoin: true,
    currency: currency
  })
  e.preventDefault()
})

// Close Checkout on page navigation:
window.addEventListener('popstate', function() {
  handler.close()
})

/*
  INITIALIZE
*/

setUIAmounts(quantity)
highlightTier(quantity)
$('.price').show()
$('.license-qty').show()
$('#currency-changer').val(currency)

var handler = StripeCheckout.configure({
  key: stripePubKey,
  image: 'https://s3.amazonaws.com/stripe-uploads/acct_1QS8MpN3AHgVTvqTgrIfmerchant-icon-1473390947610-500x500.png',
  locale: 'auto',
  token: function(token) {
    showLoading()
    superagent.post(stripeBuyURL)
      .set('Content-Type', 'application/json')
      .send({
        stripe_token: token,
        user_email: token.email,
        coupon: $('input[name=coupon]').val(),
        quantity: $('input[name=quantity]').val() || quantity,
      })
      .end(function (err, res) {
        if (err) {
          $('.messages').html('<p class="error">' + err + '</div>')
          hideLoading()
          return
        }
        if (res.body.status === 200) {
          window.location.href = res.body.redirect_url
        } else {
          hideLoading()
          $('.messages').html('<p class="error">' + res.body.message + '</div>')
        }
      })
  }
})

function showLoading() {
  $('.insync-overlay').show()
  $('body').css('cursor', 'wait')
  $('.btn-buy').prop('disabled', true)
  $('body').css('overflow', 'hidden')
}

function hideLoading() {
  $('.insync-overlay').hide()
  $('body').css('cursor', 'auto')
  $('.btn-buy').prop('disabled', false)
  $('body').css('overflow', 'visible')
}

/*
  HANDLE SPECIAL BUY TYPES
*/

if (buyType === 'redemption') {
  $('.orig-price').show()
  $('.price .amount').text(formatPrice(price - insyncCredits))
  amountDue = (price - insyncCredits) * 100
  $('.price .discount').hide()
  $('.price .help').hide()
  quantity = 1
} else if (buyType === 'referral') {
  $('.orig-price').show()
  $('.price .amount').text(formatPrice(price - referralValue))
  amountDue = (price - referralValue) * 100
  $('.price .discount').hide()
  $('.price .help').hide()
  setTimeout(function () {
    window.scrollTo(0, 0)
  }, 10)
  quantity = 1
} else {
  $('.plan .price .help').hover(function () {
    $('.discount-table').show()
  }, function () {
    $('.discount-table').hide()
  })

  $('.total-container .help').hover(function () {
    $('.item-container').show()
  }, function () {
    $('.item-container').hide()
  })
}
